sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/IconTabFilter",
    "sap/m/Dialog",
    "sap/m/Select",
    "sap/m/Input",
    "sap/m/Label",
    "sap/ui/core/Item",
    "sap/ui/layout/form/SimpleForm",
    "sap/m/Button",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "../model/formatter"
], function (Controller, JSONModel, IconTabFilter, Dialog, Select, Input, Label,
             Item, SimpleForm, Button, MessageToast, MessageBox, formatter) {
    "use strict";

    return Controller.extend("com.syntax.ricefbuilder.controller.ProjectDetail", {
        formatter: formatter,
        _projectId: null,
        _sheetType: "RICEF",
        _scopeSaveTimer: null,
        _scopeConfigTimer: null,

        onInit: function () {
            this.getView().setModel(new JSONModel({ title: "", showItems: true, showFunctional: false, showAnalytics: false }), "viewModel");
            this.getView().setModel(new JSONModel([]), "items");
            this.getView().setModel(new JSONModel({ items: [], config: {} }), "scope");
            this.getView().setModel(new JSONModel({}), "ctrl");
            var router = this.getOwnerComponent().getRouter();
            router.getRoute("project").attachPatternMatched(this._onRouteMatched, this);
            router.getRoute("projectSheet").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function (oEvent) {
            var args = oEvent.getParameter("arguments");
            this._projectId = args.projectId;
            this._sheetType = args.sheetType || "RICEF";
            this._loadProject();
            this._loadSheetTabs();
            this._switchTab(this._sheetType);
        },

        _loadProject: function () {
            var that = this;
            this.getOwnerComponent().api("GET", "/projects/" + this._projectId).then(function (p) {
                that.getView().getModel("viewModel").setProperty("/title", p.description);
                that.getView().getModel("viewModel").setProperty("/project", p);
            });
        },

        _loadSheetTabs: function () {
            var that = this;
            var tabs = this.byId("sheetTabs");
            if (tabs.getItems().length > 0) {
                tabs.setSelectedKey(this._sheetType);
                return;
            }
            this.getOwnerComponent().api("GET", "/admin/sheet-types").then(function (types) {
                types.forEach(function (t) {
                    tabs.addItem(new IconTabFilter({
                        key: t.code,
                        text: t.label,
                        icon: t.code === "RICEF" ? "sap-icon://developer-scenario" :
                              t.code === "BI" ? "sap-icon://business-objects-experience" :
                              t.code === "MIGRATION" ? "sap-icon://database" :
                              t.code === "FUNCTIONAL" ? "sap-icon://collaborate" : "sap-icon://document"
                    }));
                });
                tabs.addItem(new IconTabFilter({
                    key: "ANALYTICS",
                    text: "Analytics",
                    icon: "sap-icon://bar-chart"
                }));
                tabs.setSelectedKey(that._sheetType);
            });
        },

        _switchTab: function (sheetType) {
            var vm = this.getView().getModel("viewModel");
            vm.setProperty("/showItems", false);
            vm.setProperty("/showFunctional", false);
            vm.setProperty("/showAnalytics", false);
            if (sheetType === "ANALYTICS") {
                vm.setProperty("/showAnalytics", true);
                this._loadAnalytics();
            } else if (sheetType === "FUNCTIONAL") {
                vm.setProperty("/showFunctional", true);
                this._loadScope();
            } else {
                vm.setProperty("/showItems", true);
                this._loadItems();
                this._loadSheetControl(sheetType);
                this._loadPurpleGrid(sheetType);
            }
        },

        _loadItems: function () {
            var that = this;
            this.getOwnerComponent().api("GET",
                "/projects/" + this._projectId + "/items?sheetType=" + this._sheetType
            ).then(function (data) {
                // Insert group headers at type boundaries
                var result = [];
                var lastType = "";
                data.forEach(function (item) {
                    if (item.type_code !== lastType && !item.is_sub_item) {
                        result.push({ _isHeader: true, _headerText: item.type_label + " (" + item.type_code + ")" });
                        lastType = item.type_code;
                    }
                    result.push(item);
                });
                that.getView().getModel("items").setData(result);
            });
        },

        itemFactory: function (sId, oContext) {
            var obj = oContext.getObject();
            if (obj._isHeader) {
                return new sap.m.GroupHeaderListItem({
                    title: obj._headerText,
                    upperCase: false
                });
            }
            var oItem = new sap.m.ColumnListItem({
                type: "Navigation",
                press: [this.onItemPress, this],
                highlight: obj.classification === "TOTAL" ? "Information" : "None",
                customData: [new sap.ui.core.CustomData({ key: "itemId", value: String(obj.id) })],
                cells: [
                    new sap.m.Text({ text: obj.is_sub_item ? "  ↳ " + obj.ricef_number : obj.ricef_number }),
                    new sap.m.Text({ text: obj.type_label }),
                    new sap.m.Text({ text: obj.module }),
                    new sap.m.Text({ text: obj.description }),
                    new sap.m.ObjectStatus({ text: obj.status, state: this.formatter.statusState(obj.status) }),
                    new sap.m.Text({ text: obj.classification }),
                    new sap.m.ObjectStatus({ text: obj.complexity, state: this.formatter.complexityState(obj.complexity) }),
                    new sap.m.ObjectNumber({ number: this.formatter.hoursDisplay(obj.total_func_hours), unit: "h" }),
                    new sap.m.ObjectNumber({ number: this.formatter.hoursDisplay(obj.total_tech_hours), unit: "h" }),
                    new sap.m.ObjectNumber({ number: this.formatter.hoursDisplay(obj.grand_total_hours), unit: "h", emphasized: true })
                ]
            });
            return oItem;
        },

        _loadScope: function () {
            var that = this;
            this.getOwnerComponent().api("GET",
                "/projects/" + this._projectId + "/scope"
            ).then(function (data) {
                that.getView().getModel("scope").setData(data);
            });
            this.getOwnerComponent().api("GET",
                "/projects/" + this._projectId + "/control"
            ).then(function (data) {
                formatter.pctToDisplay(data.funcPhasePct, ["architect_pct"]);
                formatter.pctToDisplay(data.contingency);
                that.getView().getModel("ctrl").setData(data);
            });
        },

        onTabSelect: function (oEvent) {
            this._sheetType = oEvent.getParameter("key");
            this._switchTab(this._sheetType);
        },

        // --- Scope item handlers ---

        onScopeItemChange: function (oEvent) {
            var ctx = oEvent.getSource().getBindingContext("scope");
            var scopeItem = ctx.getObject();
            var that = this;

            if (this._scopeSaveTimer) clearTimeout(this._scopeSaveTimer);
            this._scopeSaveTimer = setTimeout(function () {
                that.getOwnerComponent().api("PUT",
                    "/projects/" + that._projectId + "/scope/" + scopeItem.id, scopeItem
                ).then(function () {
                    that._loadScope();
                });
            }, 500);
        },

        onScopeConfigChange: function () {
            var that = this;
            if (this._scopeConfigTimer) clearTimeout(this._scopeConfigTimer);
            this._scopeConfigTimer = setTimeout(function () {
                var config = that.getView().getModel("scope").getProperty("/config");
                that.getOwnerComponent().api("PUT",
                    "/projects/" + that._projectId + "/scope-config", config
                ).then(function () {
                    that._loadScope();
                    MessageToast.show("Config saved — hours recalculated");
                });
            }, 600);
        },

        onAddScopeItem: function () {
            var that = this;
            this.getOwnerComponent().api("POST",
                "/projects/" + this._projectId + "/scope", { func_role: "New Analyst", lob: "" }
            ).then(function () {
                that._loadScope();
                MessageToast.show("Role added");
            });
        },

        onDeleteScopeItem: function (oEvent) {
            var ctx = oEvent.getSource().getBindingContext("scope");
            var scopeItem = ctx.getObject();
            var that = this;
            this.getOwnerComponent().api("DELETE",
                "/projects/" + that._projectId + "/scope/" + scopeItem.id
            ).then(function () {
                that._loadScope();
                MessageToast.show("Role removed");
            });
        },

        // --- Analytics ---

        _loadAnalytics: function () {
            var that = this;
            this.getOwnerComponent().api("GET",
                "/projects/" + this._projectId + "/analytics"
            ).then(function (data) {
                that._renderAnalytics(data);
            });
        },

        _renderAnalytics: function (data) {
            var container = document.getElementById("analyticsContainer");
            if (!container) return;
            var that = this;
            var k = data.kpi;
            var curr = data.project ? data.project.currency : '';
            var html = '';

            // ====== KPI TILES ======
            html += '<div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:20px">';
            html += that._kpiTile("Total Hours", that._fmtNum(k.grandTotal) + "h", "Func " + that._fmtNum(k.totalFunc) + " / Tech " + that._fmtNum(k.totalTech), "#0854a0");
            html += that._kpiTile("Est. Revenue", curr + " " + that._fmtNum(k.totalBillable), "At current delivery level", "#1a6e3a");
            html += that._kpiTile("Items", k.totalItems, "Excluding sub-items", "#0854a0");
            html += that._kpiTile("TBD Items", k.tbdCount + " (" + k.tbdPct + "%)", that._fmtNum(k.tbdHours) + "h unestimated", k.tbdPct > 30 ? "#bb0000" : "#e76500");
            html += that._kpiTile("Cancelled", k.cancelledCount, "Removed from scope", "#666");
            if (k.noClassification > 0) {
                html += that._kpiTile("No Classification", k.noClassification, "Missing classification", "#bb0000");
            }
            html += '</div>';

            // ====== ROW 1: Effort by Type + Sheet/Func-Tech ======
            html += '<div style="display:flex;flex-wrap:wrap;gap:20px;margin-bottom:20px">';
            html += '<div style="flex:1;min-width:380px">';
            html += that._sectionTitle("Effort by Object Type");
            var maxHrs = data.byType.length > 0 ? data.byType[0].hours : 1;
            data.byType.forEach(function (t) {
                html += that._hBar(t.label, t.hours, maxHrs, "#0854a0", that._fmtNum(Math.round(t.hours)) + "h (" + t.count + ")", 120);
            });
            html += '</div>';

            html += '<div style="min-width:280px;max-width:340px">';
            html += that._sectionTitle("Effort by Sheet");
            var sheetColors = { RICEF: "#0854a0", BI: "#1a6e3a", MIGRATION: "#8848c0" };
            var sheetTotal = data.bySheet.reduce(function (s, x) { return s + x.hours; }, 0) || 1;
            data.bySheet.forEach(function (s) {
                var pct = Math.round(s.hours / sheetTotal * 100);
                html += '<div style="display:flex;align-items:center;margin-bottom:6px;font-size:12px">';
                html += '<div style="width:12px;height:12px;border-radius:2px;background:' + (sheetColors[s.label] || '#999') + ';margin-right:8px"></div>';
                html += '<div style="width:80px;font-weight:500">' + s.label + '</div>';
                html += '<div style="flex:1;background:#e8e8e8;border-radius:3px;height:18px">';
                html += '<div style="width:' + Math.max(pct, 2) + '%;background:' + (sheetColors[s.label] || '#999') + ';border-radius:3px;height:100%"></div>';
                html += '</div>';
                html += '<div style="width:90px;padding-left:8px;color:#333">' + that._fmtNum(Math.round(s.hours)) + 'h (' + pct + '%)</div>';
                html += '</div>';
            });

            html += '<div style="margin-top:16px">' + that._sectionTitle("Functional vs Technical") + '</div>';
            var funcPct = Math.round(k.totalFunc / (k.grandTotal || 1) * 100);
            var techPct = 100 - funcPct;
            html += '<div style="display:flex;height:24px;border-radius:4px;overflow:hidden;font-size:11px;font-weight:600;color:#fff">';
            html += '<div style="width:' + funcPct + '%;background:#0854a0;display:flex;align-items:center;justify-content:center;min-width:30px">FUNC ' + funcPct + '%</div>';
            html += '<div style="width:' + techPct + '%;background:#e76500;display:flex;align-items:center;justify-content:center;min-width:30px">TECH ' + techPct + '%</div>';
            html += '</div></div></div>';

            // ====== ROW 2: Phase Distribution (stacked bar) ======
            if (data.phaseData) {
                html += '<div style="margin-bottom:20px">';
                html += that._sectionTitle("Hours by Phase");
                var maxPhase = data.phaseData.reduce(function (m, p) { return Math.max(m, p.total); }, 1);
                data.phaseData.forEach(function (p) {
                    var fPct = Math.round(p.func / (maxPhase || 1) * 100);
                    var tPct = Math.round(p.tech / (maxPhase || 1) * 100);
                    html += '<div style="display:flex;align-items:center;margin-bottom:4px;font-size:12px">';
                    html += '<div style="width:60px;text-align:right;padding-right:8px;color:#555;font-weight:600">' + p.phase + '</div>';
                    html += '<div style="flex:1;background:#e8e8e8;border-radius:3px;height:22px;display:flex;overflow:hidden">';
                    if (fPct > 0) html += '<div style="width:' + fPct + '%;background:#0854a0;height:100%"></div>';
                    if (tPct > 0) html += '<div style="width:' + tPct + '%;background:#e76500;height:100%"></div>';
                    html += '</div>';
                    html += '<div style="width:160px;padding-left:8px;color:#333;font-size:11px">F:' + that._fmtNum(p.func) + ' T:' + that._fmtNum(p.tech) + ' = <b>' + that._fmtNum(p.total) + 'h</b></div>';
                    html += '</div>';
                });
                html += '<div style="display:flex;gap:16px;font-size:11px;margin-top:4px;padding-left:68px">';
                html += '<span><span style="display:inline-block;width:10px;height:10px;background:#0854a0;border-radius:2px;margin-right:4px"></span>Functional</span>';
                html += '<span><span style="display:inline-block;width:10px;height:10px;background:#e76500;border-radius:2px;margin-right:4px"></span>Technical</span>';
                html += '</div></div>';
            }

            // ====== ROW 3: Cost Analytics ======
            if (data.costBySheet) {
                html += '<div style="display:flex;flex-wrap:wrap;gap:20px;margin-bottom:20px">';
                html += '<div style="flex:1;min-width:340px">';
                html += that._sectionTitle("Cost by Sheet (" + curr + ")");
                html += '<table style="width:100%;border-collapse:collapse;font-size:12px">';
                html += '<tr style="background:#f2f2f2;font-weight:600">';
                html += '<td style="padding:5px 8px;border-bottom:2px solid #ccc">Sheet</td>';
                html += '<td style="padding:5px 8px;border-bottom:2px solid #ccc;text-align:right">Hours</td>';
                html += '<td style="padding:5px 8px;border-bottom:2px solid #ccc;text-align:right">Rate/hr</td>';
                html += '<td style="padding:5px 8px;border-bottom:2px solid #ccc;text-align:right">Revenue</td>';
                html += '<td style="padding:5px 8px;border-bottom:2px solid #ccc;text-align:right">Cost</td></tr>';
                data.costBySheet.forEach(function (c, i) {
                    var bg = i % 2 === 0 ? "#fff" : "#fafafa";
                    html += '<tr style="background:' + bg + '">';
                    html += '<td style="padding:4px 8px;border-bottom:1px solid #eee;font-weight:500">' + c.label + '</td>';
                    html += '<td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right">' + that._fmtNum(c.hours) + '</td>';
                    html += '<td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right">' + curr + ' ' + that._fmtNum(c.rate) + '</td>';
                    html += '<td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600">' + curr + ' ' + that._fmtNum(c.billable) + '</td>';
                    html += '<td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right">' + curr + ' ' + that._fmtNum(c.cost) + '</td>';
                    html += '</tr>';
                });
                html += '<tr style="background:#f2f2f2;font-weight:700"><td style="padding:5px 8px">Total</td>';
                html += '<td style="padding:5px 8px;text-align:right">' + that._fmtNum(k.grandTotal) + '</td><td></td>';
                html += '<td style="padding:5px 8px;text-align:right">' + curr + ' ' + that._fmtNum(k.totalBillable) + '</td>';
                html += '<td style="padding:5px 8px;text-align:right">' + curr + ' ' + that._fmtNum(k.totalCost) + '</td></tr>';
                html += '</table></div>';

                // Delivery level comparison
                if (data.costComparison) {
                    html += '<div style="min-width:280px;max-width:380px">';
                    html += that._sectionTitle("Revenue by Delivery Level (" + curr + ")");
                    var maxLvl = data.costComparison.reduce(function (m, c) { return Math.max(m, c.billable); }, 1);
                    data.costComparison.forEach(function (c) {
                        var pct = Math.max(Math.round(c.billable / maxLvl * 100), 3);
                        var color = c.isCurrent ? "#1a6e3a" : "#aaa";
                        var bold = c.isCurrent ? "font-weight:700" : "";
                        html += '<div style="display:flex;align-items:center;margin-bottom:6px;font-size:12px;' + bold + '">';
                        html += '<div style="width:160px;padding-right:8px;color:#555">' + c.label + (c.isCurrent ? ' *' : '') + '</div>';
                        html += '<div style="flex:1;background:#e8e8e8;border-radius:3px;height:20px">';
                        html += '<div style="width:' + pct + '%;background:' + color + ';border-radius:3px;height:100%"></div>';
                        html += '</div>';
                        html += '<div style="width:100px;padding-left:8px;color:#333">' + curr + ' ' + that._fmtNum(c.billable) + '</div>';
                        html += '</div>';
                    });
                    html += '<div style="font-size:11px;color:#888;margin-top:4px">* Current project level</div>';
                    html += '</div></div>';
                }
            }

            // ====== ROW 4: Complexity + Status + Module ======
            html += '<div style="display:flex;flex-wrap:wrap;gap:20px;margin-bottom:20px">';

            html += '<div style="flex:1;min-width:300px">';
            html += that._sectionTitle("Complexity Distribution");
            var complexColors = { "0-TBD": "#bb0000", "1-Very Low": "#91c8f6", "2-Low": "#5ba5e6", "3-Medium": "#0854a0", "4-High": "#e76500", "5-Very High": "#bb0000" };
            var maxComplex = data.byComplexity.reduce(function (m, c) { return Math.max(m, c.count); }, 1);
            data.byComplexity.forEach(function (c) {
                html += that._hBar(c.label.replace(/^\d-/, ''), c.count, maxComplex, complexColors[c.label] || "#999",
                    c.count + " items (" + that._fmtNum(Math.round(c.hours)) + "h)", 80);
            });
            html += '</div>';

            html += '<div style="min-width:180px;max-width:240px">';
            html += that._sectionTitle("By Status");
            var statusColors = { "New": "#0854a0", "In Progress": "#e76500", "Complete": "#1a6e3a", "Cancelled": "#999", "On Hold": "#a66700" };
            data.byStatus.forEach(function (s) {
                html += '<div style="display:flex;align-items:center;margin-bottom:6px;font-size:12px">';
                html += '<div style="width:12px;height:12px;border-radius:6px;background:' + (statusColors[s.label] || '#666') + ';margin-right:8px"></div>';
                html += '<div style="flex:1">' + s.label + '</div>';
                html += '<div style="font-weight:600;margin-left:8px">' + s.count + '</div></div>';
            });
            html += '</div>';

            if (data.byModule.length > 0) {
                html += '<div style="flex:1;min-width:300px">';
                html += that._sectionTitle("Effort by Module");
                var maxMod = data.byModule[0].hours || 1;
                data.byModule.forEach(function (m) {
                    html += that._hBar(m.label, m.hours, maxMod, "#1a6e3a", that._fmtNum(Math.round(m.hours)) + "h (" + m.count + ")", 70);
                });
                html += '</div>';
            }
            html += '</div>';

            // ====== ROW 5: Effort Concentration (Pareto) + TBD Risk ======
            html += '<div style="display:flex;flex-wrap:wrap;gap:20px;margin-bottom:20px">';

            if (data.pareto && data.pareto.length > 0) {
                html += '<div style="flex:1;min-width:320px">';
                html += that._sectionTitle("Effort Concentration (Pareto)");
                html += '<table style="width:100%;border-collapse:collapse;font-size:12px">';
                html += '<tr style="background:#f2f2f2;font-weight:600">';
                html += '<td style="padding:5px 8px;border-bottom:2px solid #ccc">Top % of Items</td>';
                html += '<td style="padding:5px 8px;border-bottom:2px solid #ccc;text-align:center">Item Count</td>';
                html += '<td style="padding:5px 8px;border-bottom:2px solid #ccc;text-align:right">Cumulative Hours</td>';
                html += '<td style="padding:5px 8px;border-bottom:2px solid #ccc;text-align:right">% of Total Hours</td></tr>';
                data.pareto.forEach(function (p, i) {
                    var bg = i % 2 === 0 ? "#fff" : "#fafafa";
                    var highlight = p.hrsPct >= 80 && (i === 0 || data.pareto[i - 1].hrsPct < 80) ? "background:#fff3cd" : "background:" + bg;
                    html += '<tr style="' + highlight + '">';
                    html += '<td style="padding:4px 8px;border-bottom:1px solid #eee;font-weight:500">' + p.itemPct + '%</td>';
                    html += '<td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:center">' + p.itemCount + '</td>';
                    html += '<td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right">' + that._fmtNum(p.cumHours) + 'h</td>';
                    html += '<td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600">' + p.hrsPct + '%</td>';
                    html += '</tr>';
                });
                html += '</table>';
                html += '<div style="font-size:11px;color:#888;margin-top:4px">Highlighted row = where 80% of effort is concentrated</div>';
                html += '</div>';
            }

            if (data.tbdByType && data.tbdByType.length > 0) {
                html += '<div style="flex:1;min-width:300px">';
                html += that._sectionTitle("TBD Risk by Object Type");
                var maxTbd = data.tbdByType[0].hours || 1;
                data.tbdByType.forEach(function (t) {
                    html += that._hBar(t.label, t.hours, maxTbd, "#bb0000",
                        t.count + " items (" + that._fmtNum(Math.round(t.hours)) + "h)", 120);
                });
                html += '<div style="font-size:11px;color:#888;margin-top:4px">Unestimated items using placeholder hours — highest risk pockets</div>';
                html += '</div>';
            }
            html += '</div>';

            // ====== ROW 6: Team Workload ======
            html += '<div style="display:flex;flex-wrap:wrap;gap:20px;margin-bottom:20px">';
            if (data.byFuncRole && data.byFuncRole.length > 0) {
                html += '<div style="flex:1;min-width:300px">';
                html += that._sectionTitle("Functional Workload by Role");
                var maxFR = data.byFuncRole[0].hours || 1;
                data.byFuncRole.forEach(function (r) {
                    html += that._hBar(r.label, r.hours, maxFR, "#0854a0", that._fmtNum(Math.round(r.hours)) + "h (" + r.count + ")", 130);
                });
                html += '</div>';
            }
            if (data.byTechRole && data.byTechRole.length > 0) {
                html += '<div style="flex:1;min-width:300px">';
                html += that._sectionTitle("Technical Workload by Role");
                var maxTR = data.byTechRole[0].hours || 1;
                data.byTechRole.forEach(function (r) {
                    html += that._hBar(r.label, r.hours, maxTR, "#e76500", that._fmtNum(Math.round(r.hours)) + "h (" + r.count + ")", 150);
                });
                html += '</div>';
            }
            html += '</div>';

            // ====== ROW 7: Complexity Heatmap ======
            if (data.heatmapData && data.heatmapData.complexities.length > 0 && data.heatmapData.types.length > 0) {
                html += '<div style="margin-bottom:20px">';
                html += that._sectionTitle("Complexity vs Object Type (Item Count)");
                html += '<div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:12px;width:100%">';
                html += '<tr style="background:#f2f2f2"><th style="padding:5px 8px;border:1px solid #ddd;text-align:left">Type \\ Complexity</th>';
                data.heatmapData.complexities.forEach(function (c) {
                    html += '<th style="padding:5px 8px;border:1px solid #ddd;text-align:center">' + c.replace(/^\d-/, '') + '</th>';
                });
                html += '<th style="padding:5px 8px;border:1px solid #ddd;text-align:center;font-weight:700">Total</th></tr>';
                data.heatmapData.types.forEach(function (t, idx) {
                    var bg = idx % 2 === 0 ? '#fff' : '#fafafa';
                    html += '<tr style="background:' + bg + '"><td style="padding:4px 8px;border:1px solid #eee;font-weight:500">' + t + '</td>';
                    var rowTotal = 0;
                    data.heatmapData.complexities.forEach(function (c) {
                        var cell = data.heatmapData.cells[c] && data.heatmapData.cells[c][t];
                        var val = cell ? cell.count : 0;
                        rowTotal += val;
                        var intensity = val === 0 ? '' : val <= 2 ? 'background:#e8f0fe' : val <= 5 ? 'background:#c6dbef' : val <= 10 ? 'background:#9ecae1' : 'background:#6baed6;color:#fff';
                        html += '<td style="padding:4px 8px;border:1px solid #eee;text-align:center;' + intensity + '">' + (val || '') + '</td>';
                    });
                    html += '<td style="padding:4px 8px;border:1px solid #eee;text-align:center;font-weight:700">' + rowTotal + '</td></tr>';
                });
                html += '</table></div></div>';
            }

            // ====== ROW 8: Top 10 ======
            html += '<div style="margin-bottom:20px">';
            html += that._sectionTitle("Top 10 Highest Effort Items");
            html += '<table style="width:100%;border-collapse:collapse;font-size:12px">';
            html += '<tr style="background:#f2f2f2;font-weight:600">';
            html += '<td style="padding:6px 8px;border-bottom:2px solid #ccc">RICEF #</td>';
            html += '<td style="padding:6px 8px;border-bottom:2px solid #ccc">Description</td>';
            html += '<td style="padding:6px 8px;border-bottom:2px solid #ccc">Type</td>';
            html += '<td style="padding:6px 8px;border-bottom:2px solid #ccc">Complexity</td>';
            html += '<td style="padding:6px 8px;border-bottom:2px solid #ccc;text-align:right">Hours</td></tr>';
            data.top10.forEach(function (t, i) {
                var bg = i % 2 === 0 ? "#fff" : "#fafafa";
                var complexStyle = t.complexity === "0-TBD" ? "color:#bb0000;font-weight:600" : "";
                html += '<tr style="background:' + bg + '">';
                html += '<td style="padding:5px 8px;border-bottom:1px solid #eee;font-weight:500">' + t.ricef_number + '</td>';
                html += '<td style="padding:5px 8px;border-bottom:1px solid #eee">' + (t.description || '') + '</td>';
                html += '<td style="padding:5px 8px;border-bottom:1px solid #eee">' + t.type + '</td>';
                html += '<td style="padding:5px 8px;border-bottom:1px solid #eee;' + complexStyle + '">' + t.complexity + '</td>';
                html += '<td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600">' + that._fmtNum(t.hours) + '</td>';
                html += '</tr>';
            });
            html += '</table></div>';

            container.innerHTML = html;
        },

        _sectionTitle: function (text) {
            return '<div style="font-weight:600;margin-bottom:8px;font-size:14px;color:#333">' + text + '</div>';
        },

        _hBar: function (label, value, max, color, suffix, labelWidth) {
            var pct = Math.max(Math.round(value / (max || 1) * 100), 2);
            var w = labelWidth || 100;
            return '<div style="display:flex;align-items:center;margin-bottom:4px;font-size:12px">' +
                '<div style="width:' + w + 'px;text-align:right;padding-right:8px;color:#555;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="' + label + '">' + label + '</div>' +
                '<div style="flex:1;background:#e8e8e8;border-radius:3px;height:20px">' +
                '<div style="width:' + pct + '%;background:' + color + ';border-radius:3px;height:100%"></div></div>' +
                '<div style="width:auto;min-width:80px;padding-left:8px;color:#333;font-weight:500;white-space:nowrap">' + suffix + '</div></div>';
        },

        _kpiTile: function (title, value, subtitle, color) {
            return '<div style="background:#fff;border-left:4px solid ' + color + ';border-radius:4px;padding:12px 16px;min-width:160px;box-shadow:0 1px 3px rgba(0,0,0,0.12)">' +
                '<div style="font-size:12px;color:#666;margin-bottom:4px">' + title + '</div>' +
                '<div style="font-size:22px;font-weight:700;color:' + color + '">' + value + '</div>' +
                '<div style="font-size:11px;color:#888;margin-top:2px">' + subtitle + '</div></div>';
        },

        _fmtNum: function (n) {
            return n != null ? n.toLocaleString() : '0';
        },

        // --- Purple Grid (Staffing Explosion) ---

        _purpleGridData: null,

        _loadPurpleGrid: function (sheetType) {
            var that = this;
            this.getOwnerComponent().api("GET",
                "/projects/" + this._projectId + "/staffing/" + sheetType
            ).then(function (data) {
                that._purpleGridData = data;
                if (that.byId("purpleGridPanel").getExpanded()) {
                    that._renderPurpleGrid();
                }
            });
        },

        onPurpleGridExpand: function (oEvent) {
            if (oEvent.getParameter("expand") && this._purpleGridData) {
                var that = this;
                setTimeout(function () { that._renderPurpleGrid(); }, 50);
            }
        },

        onPurpleGridAfterRendering: function () {
            if (this._purpleGridData && this.byId("purpleGridPanel").getExpanded()) {
                this._renderPurpleGrid();
            }
        },

        _renderPurpleGrid: function () {
            var container = document.getElementById("purpleGridContainer");
            if (container && this._purpleGridData) {
                this._buildPurpleGrid(this._purpleGridData);
            }
        },

        _buildPurpleGrid: function (data) {
            var container = document.getElementById("purpleGridContainer");
            if (!container) return;
            if (!data || !data.weekCols || data.weekCols.length === 0) {
                container.innerHTML = "<p style='padding:1rem;color:#666'>No staffing data</p>";
                return;
            }

            var phaseColors = { PREP: "#e8d0f0", FTS: "#d4b8e8", DESIGN: "#c8a8e0", BUILD: "#b890d8", "SIT/UAT": "#a878d0", DEP: "#9860c8", HYP: "#8848c0" };

            // Build phase groups for merged header
            var phaseGroups = [];
            var curPhase = null;
            data.weekCols.forEach(function (wc) {
                if (!curPhase || curPhase.phase !== wc.phase) {
                    curPhase = { phase: wc.phase, count: 1 };
                    phaseGroups.push(curPhase);
                } else {
                    curPhase.count++;
                }
            });

            var html = '<div style="overflow-x:auto;max-width:100%">';
            html += '<table style="border-collapse:collapse;font-size:12px;white-space:nowrap">';

            // Row 1: Phase headers (merged)
            html += '<tr>';
            html += '<th colspan="5" style="background:#7b2d8e;color:#fff;padding:4px 8px;text-align:center">STAFFING</th>';
            phaseGroups.forEach(function (pg) {
                var bg = phaseColors[pg.phase] || "#ccc";
                html += '<th colspan="' + pg.count + '" style="background:' + bg + ';padding:4px;text-align:center;border:1px solid #9a6bb5;font-weight:bold">' + pg.phase + '</th>';
            });
            html += '</tr>';

            // Row 2: Column headers + week numbers
            html += '<tr style="background:#f0e0f8">';
            html += '<th style="padding:3px 6px;border:1px solid #ccc;min-width:30px">Type</th>';
            html += '<th style="padding:3px 6px;border:1px solid #ccc;min-width:40px;text-align:right">%</th>';
            html += '<th style="padding:3px 6px;border:1px solid #ccc;min-width:160px">Description</th>';
            html += '<th style="padding:3px 6px;border:1px solid #ccc;min-width:30px;text-align:center">Req</th>';
            html += '<th style="padding:3px 6px;border:1px solid #ccc;min-width:100px">Function</th>';
            data.weekCols.forEach(function (wc) {
                html += '<th style="padding:3px 4px;border:1px solid #ccc;text-align:center;min-width:28px;background:#f8f0fc">' + wc.phaseWeek + '</th>';
            });
            html += '</tr>';

            // Fixed role rows
            data.fixedRoles.forEach(function (fr) {
                html += '<tr style="background:#e0f0ff;font-weight:bold">';
                html += '<td style="padding:2px 6px;border:1px solid #ddd"></td>';
                html += '<td style="padding:2px 6px;border:1px solid #ddd;text-align:right">100%</td>';
                html += '<td style="padding:2px 6px;border:1px solid #ddd">' + fr.role + '</td>';
                html += '<td style="padding:2px 6px;border:1px solid #ddd;text-align:center">1</td>';
                html += '<td style="padding:2px 6px;border:1px solid #ddd">' + fr.role + '</td>';
                fr.hours.forEach(function (h) {
                    var val = h ? h : '';
                    var bg = h ? '#e8f4fd' : '';
                    html += '<td style="padding:2px 4px;border:1px solid #ddd;text-align:center;' + (bg ? 'background:' + bg : '') + '">' + val + '</td>';
                });
                html += '</tr>';
            });

            // Developer role rows
            var lastRole = "";
            data.developers.forEach(function (dev, idx) {
                var isNewRole = dev.role !== lastRole;
                lastRole = dev.role;
                var rowBg = isNewRole ? "background:#f8f0fc" : "";
                html += '<tr style="' + rowBg + '">';
                html += '<td style="padding:2px 6px;border:1px solid #ddd;font-weight:bold;color:#7b2d8e">' + dev.type + '.</td>';
                html += '<td style="padding:2px 6px;border:1px solid #ddd;text-align:right">' + Math.round(dev.pct * 100) + '%</td>';
                html += '<td style="padding:2px 6px;border:1px solid #ddd;font-size:11px">' + dev.description + '</td>';
                html += '<td style="padding:2px 6px;border:1px solid #ddd;text-align:center">' + dev.numResources + '</td>';
                html += '<td style="padding:2px 6px;border:1px solid #ddd">' + (isNewRole ? dev.role : '') + '</td>';
                dev.hours.forEach(function (h) {
                    var val = h ? h : '';
                    var bg = h ? '#f0e8f8' : '';
                    html += '<td style="padding:2px 4px;border:1px solid #eee;text-align:center;' + (bg ? 'background:' + bg : '') + '">' + val + '</td>';
                });
                html += '</tr>';
            });

            html += '</table></div>';
            container.innerHTML = html;
        },

        // --- Sheet control section (RICEF/BI/MIGRATION) ---

        _loadSheetControl: function (sheetCode) {
            var that = this;
            this.getOwnerComponent().api("GET",
                "/projects/" + this._projectId + "/sheet-control/" + sheetCode
            ).then(function (data) {
                that._buildSheetControlTable(data, sheetCode);
            });
        },

        _buildSheetControlTable: function (data, sheetCode) {
            var that = this;
            var table = this.byId("sheetControlTable");
            table.removeAllItems();

            formatter.pctToDisplay(data.funcPct);
            (data.fixedRoles || []).forEach(function (r) { formatter.fixedRolePctToDisplay(r); });

            var ColumnListItem = sap.m.ColumnListItem;
            var Text = sap.m.Text;
            var InputCtrl = sap.m.Input;
            var phases = ["prep", "fts", "design", "build", "sit_uat", "dep", "hyp"];

            // Row 1: FUNC % Explore vs Build
            if (data.funcPct) {
                var funcRow = new ColumnListItem();
                funcRow.addCell(new Text({ text: "FUNC  % Explore vs Build" }).addStyleClass("sapUiSmallMarginBegin"));
                phases.forEach(function (p) {
                    var inp = new InputCtrl({
                        value: "{sheetCtrl>/funcPct/" + p + "}",
                        type: "Number", textAlign: "Center",
                        change: function () { that._saveSheetFuncPct(sheetCode); }
                    });
                    funcRow.addCell(inp);
                });
                table.addItem(funcRow);
            }

            // Fixed role rows
            (data.fixedRoles || []).forEach(function (role) {
                var roleRow = new ColumnListItem();
                roleRow.addCell(new Text({ text: role.role_name }).addStyleClass("sapUiSmallMarginBegin"));
                phases.forEach(function (p) {
                    var idx = data.fixedRoles.indexOf(role);
                    var inp = new InputCtrl({
                        value: "{sheetCtrl>/fixedRoles/" + idx + "/" + p + "}",
                        type: "Number", textAlign: "Center",
                        change: function () { that._saveFixedRole(role.id, idx); }
                    });
                    roleRow.addCell(inp);
                });
                table.addItem(roleRow);
            });

            this.getView().setModel(new sap.ui.model.json.JSONModel(data), "sheetCtrl");
        },

        _saveSheetFuncPct: function (sheetCode) {
            var that = this;
            if (this._sheetFuncTimer) clearTimeout(this._sheetFuncTimer);
            this._sheetFuncTimer = setTimeout(function () {
                var data = JSON.parse(JSON.stringify(that.getView().getModel("sheetCtrl").getProperty("/funcPct")));
                formatter.pctFromDisplay(data);
                that.getOwnerComponent().api("PUT",
                    "/projects/" + that._projectId + "/sheet-control/" + sheetCode + "/func-pct", data
                ).then(function () { MessageToast.show("Saved"); });
            }, 600);
        },

        _saveFixedRole: function (roleId, idx) {
            var that = this;
            if (this._fixedRoleTimer) clearTimeout(this._fixedRoleTimer);
            this._fixedRoleTimer = setTimeout(function () {
                var data = JSON.parse(JSON.stringify(that.getView().getModel("sheetCtrl").getProperty("/fixedRoles/" + idx)));
                formatter.fixedRolePctFromDisplay(data);
                that.getOwnerComponent().api("PUT",
                    "/projects/" + that._projectId + "/fixed-role/" + roleId, data
                ).then(function () { MessageToast.show("Saved"); });
            }, 600);
        },

        onFuncCtrlChange: function (oEvent) {
            var section = oEvent.getSource().data("s");
            if (!section) return;
            var that = this;
            if (this._funcCtrlTimer) clearTimeout(this._funcCtrlTimer);
            this._funcCtrlTimer = setTimeout(function () {
                var oModel = that.getView().getModel("ctrl");
                var data, endpoint;
                if (section === "func-phase-pct") {
                    data = JSON.parse(JSON.stringify(oModel.getProperty("/funcPhasePct")));
                    formatter.pctFromDisplay(data, ["architect_pct"]);
                    endpoint = "/projects/" + that._projectId + "/control/func-phase-pct";
                } else if (section === "contingency") {
                    data = JSON.parse(JSON.stringify(oModel.getProperty("/contingency")));
                    formatter.pctFromDisplay(data);
                    endpoint = "/projects/" + that._projectId + "/control/contingency";
                }
                if (endpoint) {
                    that.getOwnerComponent().api("PUT", endpoint, data).then(function () {
                        MessageToast.show("Saved");
                    });
                }
            }, 600);
        },

        // --- Items handlers ---

        onSearch: function (oEvent) {
            var query = oEvent.getParameter("query") || "";
            var that = this;
            var url = "/projects/" + this._projectId + "/items?sheetType=" + this._sheetType;
            if (query) url += "&search=" + encodeURIComponent(query);
            this.getOwnerComponent().api("GET", url).then(function (data) {
                that.getView().getModel("items").setData(data);
            });
        },

        onItemPress: function (oEvent) {
            var itemId = oEvent.getSource().data("itemId");
            if (!itemId) return;
            this.getOwnerComponent().getRouter().navTo("itemDetail", {
                projectId: this._projectId,
                itemId: itemId
            });
        },

        onAddItem: function () {
            var that = this;
            this.getOwnerComponent().api("GET", "/admin/ricef-types").then(function (types) {
                var filtered = types.filter(function (t) {
                    return t.is_active && t.sheet_type_code === that._sheetType;
                });
                that._showAddDialog(filtered);
            });
        },

        _showAddDialog: function (ricefTypes) {
            var that = this;
            var oTypeSelect = new Select({ width: "100%" });
            ricefTypes.forEach(function (t) {
                oTypeSelect.addItem(new Item({ key: t.id, text: t.label }));
            });
            var oModuleInput = new Input({ placeholder: "e.g. PP, FI, OTC" });
            var oDescInput = new Input({ placeholder: "Brief description" });

            var dialog = new Dialog({
                title: "Add " + this._sheetType + " Item",
                content: new SimpleForm({
                    editable: true,
                    content: [
                        new Label({ text: "RICEF Type" }), oTypeSelect,
                        new Label({ text: "Module" }), oModuleInput,
                        new Label({ text: "Description" }), oDescInput
                    ]
                }),
                beginButton: new Button({
                    text: "Add",
                    type: "Emphasized",
                    press: function () {
                        that.getOwnerComponent().api("POST",
                            "/projects/" + that._projectId + "/items", {
                                ricef_type_id: parseInt(oTypeSelect.getSelectedKey()),
                                module: oModuleInput.getValue(),
                                description: oDescInput.getValue()
                            }
                        ).then(function () {
                            MessageToast.show("Item added");
                            dialog.close();
                            that._loadItems();
                        });
                    }
                }),
                endButton: new Button({
                    text: "Cancel",
                    press: function () { dialog.close(); }
                }),
                afterClose: function () { dialog.destroy(); }
            });
            dialog.open();
        },

        onDeleteItems: function () {
            var that = this;
            var table = this.byId("itemsTable");
            var selected = table.getSelectedItems();
            if (selected.length === 0) {
                MessageToast.show("Select items to delete");
                return;
            }
            MessageBox.confirm("Delete " + selected.length + " item(s)?", {
                onClose: function (action) {
                    if (action === MessageBox.Action.OK) {
                        var promises = selected.map(function (item) {
                            var id = item.getBindingContext("items").getProperty("id");
                            return that.getOwnerComponent().api("DELETE",
                                "/projects/" + that._projectId + "/items/" + id);
                        });
                        Promise.all(promises).then(function () {
                            MessageToast.show("Deleted");
                            that._loadItems();
                        });
                    }
                }
            });
        },

        onRecalcAll: function () {
            var that = this;
            this.getOwnerComponent().api("POST",
                "/projects/" + this._projectId + "/recalculate-all"
            ).then(function (r) {
                MessageToast.show(r.recalculated + " items recalculated");
                if (that._sheetType === "FUNCTIONAL") {
                    that._loadScope();
                } else {
                    that._loadItems();
                }
            });
        },

        onNavSummary: function () {
            this.getOwnerComponent().getRouter().navTo("summary", { projectId: this._projectId });
        },

        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("home");
        }
    });
});
