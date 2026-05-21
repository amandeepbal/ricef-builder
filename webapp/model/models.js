sap.ui.define([
    "sap/ui/model/json/JSONModel"
], function (JSONModel) {
    "use strict";
    return {
        createDeviceModel: function () {
            return new JSONModel({
                isPhone: sap.ui.Device.system.phone
            });
        }
    };
});
