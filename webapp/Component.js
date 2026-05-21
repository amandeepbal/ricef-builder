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
            this.setModel(new JSONModel({ busy: false }), "appView");
            this.getRouter().initialize();
        },

        api: function (method, path, data) {
            var opts = {
                method: method,
                headers: { "Content-Type": "application/json" }
            };
            if (data) opts.body = JSON.stringify(data);
            return fetch("/api" + path, opts).then(function (r) {
                if (!r.ok) {
                    return r.json().then(function (err) {
                        throw new Error(err.error || "Request failed");
                    });
                }
                return r.json();
            });
        }
    });
});
