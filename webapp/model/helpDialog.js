sap.ui.define([
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/ScrollContainer",
    "sap/m/VBox",
    "sap/m/Title",
    "sap/m/Text",
    "sap/m/Panel"
], function (Dialog, Button, ScrollContainer, VBox, Title, Text, Panel) {
    "use strict";

    var _helpData = null;

    return {
        show: function (pageKey, ownerComponent) {
            var doShow = function (data) {
                var page = data[pageKey];
                if (!page) {
                    sap.m.MessageToast.show("No help available for this page");
                    return;
                }

                var content = new VBox({ class: "sapUiSmallMargin" });
                (page.sections || []).forEach(function (sec) {
                    var panel = new Panel({
                        headerText: sec.heading,
                        expandable: true,
                        expanded: true
                    });
                    var lines = sec.content.split("\n");
                    var vbox = new VBox();
                    lines.forEach(function (line) {
                        var isBullet = line.trim().indexOf("•") === 0;
                        var t = new Text({
                            text: line,
                            wrapping: true
                        });
                        if (isBullet) t.addStyleClass("sapUiTinyMarginBegin");
                        vbox.addItem(t);
                    });
                    panel.addContent(vbox);
                    content.addItem(panel);
                });

                var scroll = new ScrollContainer({
                    height: "70vh",
                    vertical: true,
                    content: [content]
                });

                var dialog = new Dialog({
                    title: page.title + " — Help",
                    contentWidth: "600px",
                    content: [scroll],
                    endButton: new Button({
                        text: "Close",
                        press: function () { dialog.close(); }
                    }),
                    afterClose: function () { dialog.destroy(); }
                });
                dialog.addStyleClass("sapUiSizeCompact");
                dialog.open();
            };

            if (_helpData) {
                doShow(_helpData);
            } else {
                jQuery.ajax({
                    url: "model/help.json",
                    dataType: "json",
                    success: function (data) {
                        _helpData = data;
                        doShow(data);
                    }
                });
            }
        }
    };
});
