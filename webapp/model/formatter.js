sap.ui.define([], function () {
    "use strict";

    var PCT_PHASES = ["prep", "fts", "design", "build", "sit_uat", "dep", "hyp"];

    function _walk(obj, fields, fn) {
        if (!obj) return obj;
        fields.forEach(function (f) {
            if (obj[f] != null) obj[f] = fn(obj[f]);
        });
        return obj;
    }

    return {
        hoursDisplay: function (v) {
            if (!v && v !== 0) return "";
            return parseFloat(v).toFixed(1);
        },

        pctToDisplay: function (obj, extraFields) {
            var fields = PCT_PHASES.concat(extraFields || []);
            return _walk(obj, fields, function (v) { return Math.round(v * 10000) / 100; });
        },

        pctFromDisplay: function (obj, extraFields) {
            var fields = PCT_PHASES.concat(extraFields || []);
            return _walk(obj, fields, function (v) { return parseFloat(v) / 100; });
        },

        fixedRolePctToDisplay: function (role) {
            if (!role) return role;
            ["dep", "hyp"].forEach(function (f) {
                if (role[f] != null && role[f] > 0 && role[f] < 1) {
                    role[f] = Math.round(role[f] * 10000) / 100;
                    role[f + "_isPct"] = true;
                }
            });
            return role;
        },

        fixedRolePctFromDisplay: function (role) {
            if (!role) return role;
            ["dep", "hyp"].forEach(function (f) {
                if (role[f + "_isPct"]) {
                    role[f] = parseFloat(role[f]) / 100;
                }
            });
            return role;
        },
        statusState: function (s) {
            switch (s) {
                case "New": return "Information";
                case "In Review": return "Warning";
                case "Confirmed": return "Success";
                case "Cancelled": return "Error";
                default: return "None";
            }
        },
        complexityState: function (c) {
            if (!c) return "None";
            if (c.indexOf("Very High") >= 0) return "Error";
            if (c.indexOf("High") >= 0) return "Warning";
            if (c.indexOf("Medium") >= 0) return "None";
            return "Success";
        }
    };
});
