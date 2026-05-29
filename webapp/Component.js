sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel"
], function (UIComponent, JSONModel) {
    "use strict";

    return UIComponent.extend("com.syntax.ricefbuilder.Component", {
        metadata: {
            manifest: "json"
        },

        init: function () {
            UIComponent.prototype.init.apply(this, arguments);
            this.setModel(new JSONModel({ busy: false, showNavButton: false, showMenuButton: false, showSideNav: false }), "appView");
            this.getRouter().initialize();
        },

        _sessionExpiredShown: false,

        _showSessionExpired: function () {
            if (this._sessionExpiredShown) return;
            this._sessionExpiredShown = true;
            sap.ui.require(["sap/m/MessageBox"], function (MessageBox) {
                MessageBox.warning(
                    "Your session has expired. Please log in again to continue.",
                    {
                        title: "Session Expired",
                        actions: ["Re-login"],
                        emphasizedAction: "Re-login",
                        onClose: function () { location.reload(); }
                    }
                );
            });
        },

        api: function (method, path, data) {
            var that = this;
            var opts = {
                method: method,
                headers: {
                    "Content-Type": "application/json",
                    // Tells the approuter to return 401 for AJAX instead of a 302
                    // redirect to the IDP (which fetch cannot follow cross-origin).
                    "X-Requested-With": "XMLHttpRequest"
                }
            };
            if (data) opts.body = JSON.stringify(data);
            return fetch("/api" + path, opts).then(function (r) {
                var ct = r.headers.get("content-type") || "";
                var isJson = ct.indexOf("application/json") >= 0;
                var isHtml = ct.indexOf("text/html") >= 0;

                // Session expired / not authenticated. On BTP the approuter may
                // answer with 401, redirect to the IDP login, or serve the login
                // page as HTML. Show the dialog and halt the chain with a promise
                // that never settles, so no downstream .then/.catch can override
                // the dialog (e.g. by navigating home or showing a generic error).
                if (r.status === 401 ||
                    r.redirected ||
                    (r.status === 403 && !isJson) ||
                    (r.ok && isHtml)) {
                    that._showSessionExpired();
                    return new Promise(function () {});
                }
                if (!r.ok) {
                    return r.text().then(function (body) {
                        var msg = "Request failed (" + r.status + ")";
                        try {
                            var err = JSON.parse(body);
                            if (err && err.error) msg = err.error;
                        } catch (e) { /* non-JSON error body */ }
                        throw new Error(msg);
                    });
                }
                return r.json();
            });
        }
    });
});
