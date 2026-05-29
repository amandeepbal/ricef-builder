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
                headers: { "Content-Type": "application/json" }
            };
            if (data) opts.body = JSON.stringify(data);
            return fetch("/api" + path, opts).then(function (r) {
                if (r.status === 401 || r.status === 403) {
                    var ct = r.headers.get("content-type") || "";
                    if (r.status === 401 || !ct.includes("application/json")) {
                        that._showSessionExpired();
                        throw new Error("Session expired");
                    }
                }
                if (r.redirected) {
                    that._showSessionExpired();
                    throw new Error("Session expired");
                }
                if (!r.ok) {
                    return r.text().then(function (body) {
                        try {
                            var err = JSON.parse(body);
                            throw new Error(err.error || "Request failed");
                        } catch (e) {
                            if (e.message === "Session expired") throw e;
                            throw new Error("Request failed (" + r.status + ")");
                        }
                    });
                }
                return r.json();
            });
        }
    });
});
