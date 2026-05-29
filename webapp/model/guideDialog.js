sap.ui.define([
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/ScrollContainer",
    "sap/m/VBox",
    "sap/m/Text",
    "sap/m/Panel",
    "sap/m/IconTabBar",
    "sap/m/IconTabFilter"
], function (Dialog, Button, ScrollContainer, VBox, Text, Panel, IconTabBar, IconTabFilter) {
    "use strict";

    var _guideData = null;

    function _buildTabContent(tab) {
        var vbox = new VBox({ class: "sapUiSmallMargin" });
        (tab.sections || []).forEach(function (sec) {
            var panel = new Panel({
                headerText: sec.heading,
                expandable: true,
                expanded: true
            });
            var content = new VBox();
            sec.content.split("\n").forEach(function (line) {
                var isBullet = line.trim().indexOf("•") === 0;
                var isNumbered = /^\d+\./.test(line.trim());
                var t = new Text({ text: line, wrapping: true });
                if (isBullet || isNumbered) {
                    t.addStyleClass("sapUiTinyMarginBegin");
                }
                content.addItem(t);
            });
            panel.addContent(content);
            vbox.addItem(panel);
        });
        return vbox;
    }

    return {
        show: function () {
            var doShow = function (data) {
                var oTabBar = new IconTabBar({
                    stretchContentHeight: true,
                    expandable: false,
                    headerMode: "Inline"
                });

                (data.tabs || []).forEach(function (tab) {
                    var scroll = new ScrollContainer({
                        height: "100%",
                        vertical: true,
                        content: [_buildTabContent(tab)]
                    });
                    oTabBar.addItem(new IconTabFilter({
                        key: tab.key,
                        text: tab.title,
                        icon: tab.icon,
                        content: [scroll]
                    }));
                });

                var dialog = new Dialog({
                    title: "Application Guide",
                    contentWidth: "48rem",
                    contentHeight: "70vh",
                    draggable: true,
                    resizable: true,
                    content: [oTabBar],
                    endButton: new Button({
                        text: "Close",
                        press: function () { dialog.close(); }
                    }),
                    afterClose: function () { dialog.destroy(); }
                });
                dialog.addStyleClass("sapUiSizeCompact");
                dialog.open();
            };

            if (_guideData) {
                doShow(_guideData);
            } else {
                jQuery.ajax({
                    url: "model/guide.json",
                    dataType: "json",
                    success: function (data) {
                        _guideData = data;
                        doShow(data);
                    }
                });
            }
        }
    };
});
