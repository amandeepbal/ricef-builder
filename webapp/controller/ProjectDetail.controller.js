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
    "../model/formatter",
    "../model/helpDialog"
], function (Controller, JSONModel, IconTabFilter, Dialog, Select, Input, Label,
             Item, SimpleForm, Button, MessageToast, MessageBox, formatter, helpDialog) {
    "use strict";

    return Controller.extend("com.syntax.ricefbuilder.controller.ProjectDetail", {
        formatter: formatter,
        _projectId: null,
        _sheetType: "RICEF",
        _scopeSaveTimer: null,

        _isDark: function () {
            var t = sap.ui.getCore().getConfiguration().getTheme();
            return t.indexOf("dark") >= 0 || t.indexOf("hcb") >= 0;
        },
        _gc: function (grid) {
            var dk = this._isDark();
            var schemes = {
                orange: {
                    hdrBg: "#e76500", hdrFg: "#fff", sectionBg: "#f5a623",
                    subHdrBg: dk ? "#3d2e1a" : "#fdf0e2",
                    borderClr: dk ? "#6b5030" : "#d4a574",
                    highlightBg: dk ? "#3d3520" : "#fff3cd",
                    rowBg1: dk ? "#1e1e1e" : "#fff",
                    rowBg2: dk ? "#2a2518" : "#fef8f0",
                    textClr: dk ? "#e0e0e0" : "inherit"
                },
                blue: {
                    hdrBg: "#0854a0", hdrFg: "#fff", sectionBg: "#2b7cd0",
                    subHdrBg: dk ? "#1a2a3d" : "#e0ecf8",
                    borderClr: dk ? "#305878" : "#7baed4",
                    highlightBg: dk ? "#1a3050" : "#d6eaf8",
                    rowBg1: dk ? "#1e1e1e" : "#fff",
                    rowBg2: dk ? "#1a2530" : "#f0f6fc",
                    textClr: dk ? "#e0e0e0" : "inherit"
                },
                purple: {
                    hdrBg: "#7b2d8e", hdrFg: "#fff", sectionBg: "#9b59b6",
                    subHdrBg: dk ? "#2d1a33" : "#f8f0fc",
                    borderClr: dk ? "#5a3068" : "#ccc",
                    highlightBg: dk ? "#3d2045" : "#f8f0fc",
                    rowBg1: dk ? "#1e1e1e" : "#fff",
                    rowBg2: dk ? "#2a1e30" : "#fafafa",
                    textClr: dk ? "#e0e0e0" : "inherit"
                }
            };
            var c = schemes[grid] || schemes.orange;
            c.cellBorder = "1px solid " + c.borderClr;
            return c;
        },
        _scopeConfigTimer: null,

        onInit: function () {
            this.getView().setModel(new JSONModel({ title: "", showItems: true, showFunctional: false, showAnalytics: false, showSnapshots: false }), "viewModel");
            this.getView().setModel(new JSONModel([]), "items");
            this.getView().setModel(new JSONModel({ items: [], config: {} }), "scope");
            this.getView().setModel(new JSONModel({}), "ctrl");
            this.getView().setModel(new JSONModel([]), "snapshots");
            this.getView().setModel(new JSONModel([]), "funcRoles");
            this.getView().setModel(new JSONModel({ scopeEffort: [], techScopeEffort: [], totalEffort: [] }), "funcEffort");
            this.getView().setModel(new JSONModel({ funcRows: [], techRows: [] }), "orangeGrid");
            this.getView().setModel(new JSONModel({}), "blueCtrl");
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
                var vm = that.getView().getModel("viewModel");
                vm.setProperty("/title", p.description + (p.is_readonly ? " (Read-Only)" : ""));
                vm.setProperty("/project", p);
                vm.setProperty("/projectNumber", p.project_number || "Project");
                vm.setProperty("/editable", !p.is_readonly);
                vm.setProperty("/readonly", !!p.is_readonly);

                var page = that.byId("projectPage");
                if (p.is_readonly) {
                    page.addStyleClass("readOnlyProject");
                } else {
                    page.removeStyleClass("readOnlyProject");
                }
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
                        icon: t.code === "RICEF" ? "sap-icon://wrench" :
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
                tabs.addItem(new IconTabFilter({
                    key: "SNAPSHOTS",
                    text: "Snapshots",
                    icon: "sap-icon://camera"
                }));
                tabs.setSelectedKey(that._sheetType);
            });
        },

        _switchTab: function (sheetType) {
            var strip = this.byId("actionConfirmStrip");
            if (strip) strip.setVisible(false);

            var vm = this.getView().getModel("viewModel");
            vm.setProperty("/showItems", false);
            vm.setProperty("/showFunctional", false);
            vm.setProperty("/showAnalytics", false);
            vm.setProperty("/showSnapshots", false);
            if (sheetType === "SNAPSHOTS") {
                vm.setProperty("/showSnapshots", true);
                this._loadSnapshots();
            } else if (sheetType === "ANALYTICS") {
                vm.setProperty("/showAnalytics", true);
                this._loadAnalytics();
            } else if (sheetType === "FUNCTIONAL") {
                vm.setProperty("/showFunctional", true);
                this._loadScope();
            } else {
                vm.setProperty("/showItems", true);
                this._filtersPopulated = false;
                this._resetFilters();
                this._loadItems();
                this._loadOrangeGrid(sheetType);
                this._loadBlueGrid(sheetType);
                this._loadSheetControl(sheetType, "ORANGE");
                this._loadBlueSheetControl(sheetType);
                this._loadPurpleGrid(sheetType);
            }
        },

        _allItems: [],
        _filtersPopulated: false,

        _resetFilters: function () {
            var Item = sap.ui.core.Item;
            ["filterStatus", "filterComplexity", "filterModule"].forEach(function (id) {
                var sel = this.byId(id);
                sel.removeAllItems();
                sel.addItem(new Item({ key: "", text: "All" }));
                sel.setSelectedKey("");
            }.bind(this));
            this.byId("searchField").setValue("");
        },

        _pendingTypeFilter: null,
        _pendingComplexityFilter: null,

        _loadItems: function () {
            var that = this;
            this.getOwnerComponent().api("GET",
                "/projects/" + this._projectId + "/items?sheetType=" + this._sheetType
            ).then(function (data) {
                that._allItems = data;
                if (!that._filtersPopulated) {
                    that._populateFilters(data);
                    that._filtersPopulated = true;
                }
                if (that._pendingComplexityFilter) {
                    that.byId("filterComplexity").setSelectedKey(that._pendingComplexityFilter);
                }
                that._applyFilters();
                if (that._pendingTypeFilter) {
                    var msg = "Filtered: " + that._pendingTypeFilter;
                    if (that._pendingComplexityFilter) msg += " / " + that._pendingComplexityFilter.replace(/^\d-/, '');
                    MessageToast.show(msg);
                }
                that._pendingTypeFilter = null;
                that._pendingComplexityFilter = null;
            });
        },

        _populateFilters: function (data) {
            var Item = sap.ui.core.Item;
            var statusSet = {}, complexSet = {}, moduleSet = {};
            data.forEach(function (r) {
                if (r.status) statusSet[r.status] = true;
                if (r.complexity) complexSet[r.complexity] = true;
                if (r.module) moduleSet[r.module] = true;
            });

            var statusFilter = this.byId("filterStatus");
            Object.keys(statusSet).sort().forEach(function (v) {
                statusFilter.addItem(new Item({ key: v, text: v }));
            });
            var complexFilter = this.byId("filterComplexity");
            Object.keys(complexSet).sort().forEach(function (v) {
                complexFilter.addItem(new Item({ key: v, text: v }));
            });
            var moduleFilter = this.byId("filterModule");
            Object.keys(moduleSet).sort().forEach(function (v) {
                moduleFilter.addItem(new Item({ key: v, text: v }));
            });
        },

        _applyFilters: function () {
            var status = this.byId("filterStatus").getSelectedKey();
            var complexity = this.byId("filterComplexity").getSelectedKey();
            var mod = this.byId("filterModule").getSelectedKey();
            var search = (this.byId("searchField").getValue() || "").toLowerCase();
            var typeFilter = this._pendingTypeFilter || null;

            var filtered = this._allItems.filter(function (item) {
                if (status && item.status !== status) return false;
                if (complexity && item.complexity !== complexity) return false;
                if (mod && item.module !== mod) return false;
                if (typeFilter && item.type_label !== typeFilter) return false;
                if (search && !(
                    (item.ricef_number || "").toLowerCase().indexOf(search) >= 0 ||
                    (item.description || "").toLowerCase().indexOf(search) >= 0 ||
                    (item.classification || "").toLowerCase().indexOf(search) >= 0
                )) return false;
                return true;
            });

            var result = [];
            var lastType = "";
            filtered.forEach(function (item) {
                if (item.type_code !== lastType && !item.is_sub_item) {
                    result.push({ _isHeader: true, _headerText: item.type_label + " (" + item.type_code + ")" });
                    lastType = item.type_code;
                }
                result.push(item);
            });
            this.getView().getModel("items").setData(result);
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
                formatter.pctToDisplay(data.funcPhasePct, ["architect_pct", "arch_prep", "arch_fts", "arch_design", "arch_build", "arch_sit_uat", "arch_dep", "arch_hyp"]);
                formatter.pctToDisplay(data.contingency);
                that.getView().getModel("ctrl").setData(data);
            });
            this.getOwnerComponent().api("GET", "/admin/dropdowns/FUNC_ROLE").then(function (cat) {
                var roles = (cat.values || []).filter(function (v) { return v.is_active && !v.is_separator; });
                that.getView().getModel("funcRoles").setData(roles);
            });
            this._loadFuncEffort();
        },

        _loadFuncEffort: function () {
            var that = this;
            this.getOwnerComponent().api("GET",
                "/projects/" + this._projectId + "/summary"
            ).then(function (data) {
                var archRow = data.funcArchitect || {};
                archRow._highlight = true;
                var totalEffort = [archRow];
                (data.funcByRole || []).forEach(function (r) { totalEffort.push(r); });

                that.getView().getModel("funcEffort").setData({
                    scopeEffort: data.funcScopeEffort || [],
                    techScopeEffort: data.techScopeEffort || [],
                    totalEffort: totalEffort
                });
                that._renderFuncOrangeGrid(data.funcScopeEffort || [], data.techScopeEffort || [], totalEffort);
            });
        },

        onFuncOrangeGridAfterRendering: function () {
            var m = this.getView().getModel("funcEffort");
            if (m) {
                this._renderFuncOrangeGrid(m.getProperty("/scopeEffort") || [], m.getProperty("/techScopeEffort") || [], m.getProperty("/totalEffort") || []);
            }
        },

        _renderFuncOrangeGrid: function (scopeEffort, techScopeEffort, totalEffort) {
            var container = document.getElementById("funcOrangeGridContainer");
            if (!container) return;

            var phases = ["prep", "fts", "design", "build", "sit_uat", "dep", "hyp"];
            var phaseLabels = ["PREP", "FTS", "DESIGN", "BUILD", "SIT/UAT", "DEP", "HYP"];

            var c = this._gc("orange");

            var html = '<div style="overflow-x:auto;max-width:100%">';
            html += '<table class="effortGrid" style="border-collapse:collapse;font-size:12px;white-space:nowrap;width:100%;color:' + c.textClr + '">';

            var totalCols = 11;
            html += '<tr><th colspan="' + totalCols + '" style="background:' + c.hdrBg + ';color:' + c.hdrFg + ';padding:6px 10px;text-align:left;font-size:13px">';
            html += 'FUNCTIONAL — ORANGE GRID</th></tr>';

            function renderSection(title, rows, hasLeadCols) {
                html += '<tr><td colspan="' + totalCols + '" style="background:' + c.sectionBg + ';color:#fff;padding:4px 10px;font-weight:bold;border:' + c.cellBorder + '">' + title + '</td></tr>';
                html += '<tr style="background:' + c.subHdrBg + '">';
                html += '<th style="padding:4px 8px;border:' + c.cellBorder + ';text-align:left;min-width:180px">Role</th>';
                phaseLabels.forEach(function (lbl) {
                    html += '<th style="padding:4px 8px;border:' + c.cellBorder + ';text-align:center;min-width:60px">' + lbl + '</th>';
                });
                html += '<th style="padding:4px 8px;border:' + c.cellBorder + ';text-align:right;min-width:70px;font-weight:bold">TOTAL</th>';
                if (hasLeadCols) {
                    html += '<th style="padding:4px 8px;border:' + c.cellBorder + ';text-align:right;min-width:55px">Lead</th>';
                    html += '<th style="padding:4px 8px;border:' + c.cellBorder + ';text-align:right;min-width:70px">Consultant</th>';
                } else {
                    html += '<th style="border:' + c.cellBorder + '"></th><th style="border:' + c.cellBorder + '"></th>';
                }
                html += '</tr>';

                if (!rows || rows.length === 0) {
                    html += '<tr><td colspan="' + totalCols + '" style="padding:6px 8px;border:' + c.cellBorder + ';color:#888;text-align:center;font-style:italic">No data</td></tr>';
                    return;
                }

                rows.forEach(function (r, idx) {
                    var isHL = r._highlight;
                    var bg = isHL ? c.highlightBg : (idx % 2 === 0 ? c.rowBg1 : c.rowBg2);
                    var fw = isHL ? 'font-weight:bold' : '';
                    html += '<tr style="background:' + bg + ';' + fw + '">';
                    html += '<td style="padding:3px 8px;border:' + c.cellBorder + ';font-weight:500">' + (r.role || '') + '</td>';
                    var rowTotal = 0;
                    phases.forEach(function (p) {
                        var v = r[p] || 0;
                        rowTotal += v;
                        html += '<td style="padding:3px 8px;border:' + c.cellBorder + ';text-align:center">' + (v ? Math.round(v) : '') + '</td>';
                    });
                    var total = r.total || rowTotal;
                    html += '<td style="padding:3px 8px;border:' + c.cellBorder + ';text-align:right;font-weight:bold">' + (total ? Math.round(total) : '') + '</td>';
                    if (hasLeadCols) {
                        html += '<td style="padding:3px 8px;border:' + c.cellBorder + ';text-align:right">' + (r.lead ? Math.round(r.lead) : '') + '</td>';
                        html += '<td style="padding:3px 8px;border:' + c.cellBorder + ';text-align:right">' + (r.consultant ? Math.round(r.consultant) : '') + '</td>';
                    } else {
                        html += '<td style="border:' + c.cellBorder + '"></td><td style="border:' + c.cellBorder + '"></td>';
                    }
                    html += '</tr>';
                });
            }

            renderSection("Functional Scope — Functional Effort", scopeEffort, false);
            renderSection("Technical Scope — Functional Effort", techScopeEffort, false);
            renderSection("Total — Functional Effort", totalEffort, true);

            html += '</table></div>';
            container.innerHTML = html;
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

            if (!k || k.totalItems === 0) {
                container.innerHTML = '<div class="analyticsEmpty">' +
                    '<span style="font-size:3rem;color:#bbb;margin-bottom:1rem">&#x1f4ca;</span>' +
                    '<div style="font-size:16px;font-weight:600;color:var(--sapContent_LabelColor, #666);margin-bottom:0.5rem">No Items to Analyze</div>' +
                    '<div style="font-size:13px;color:#888">Add items to the RICEF, BI, or Migration tabs to see analytics here.</div></div>';
                return;
            }

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
                html += '<div style="width:90px;padding-left:8px;color:var(--sapTextColor, #333)">' + that._fmtNum(Math.round(s.hours)) + 'h (' + pct + '%)</div>';
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
                    html += '<div style="width:160px;padding-left:8px;color:var(--sapTextColor, #333);font-size:11px">F:' + that._fmtNum(p.func) + ' T:' + that._fmtNum(p.tech) + ' = <b>' + that._fmtNum(p.total) + 'h</b></div>';
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
                        html += '<div style="width:100px;padding-left:8px;color:var(--sapTextColor, #333)">' + curr + ' ' + that._fmtNum(c.billable) + '</div>';
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
                var tsMap = data.heatmapData.typeToSheet || {};
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
                    var sheet = tsMap[t] || 'RICEF';
                    html += '<tr style="background:' + bg + '"><td style="padding:4px 8px;border:1px solid #eee;font-weight:500">' + t + '</td>';
                    var rowTotal = 0;
                    data.heatmapData.complexities.forEach(function (c) {
                        var cell = data.heatmapData.cells[c] && data.heatmapData.cells[c][t];
                        var val = cell ? cell.count : 0;
                        rowTotal += val;
                        var intensity = val === 0 ? '' : val <= 2 ? 'background:#e8f0fe' : val <= 5 ? 'background:#c6dbef' : val <= 10 ? 'background:#9ecae1' : 'background:#6baed6;color:#fff';
                        var clickAttr = val > 0 ? ' data-hm-click="1" data-hm-type="' + t + '" data-hm-complexity="' + c + '" data-hm-sheet="' + sheet + '" title="Click to view ' + t + ' — ' + c.replace(/^\d-/, '') + '" style="padding:4px 8px;border:1px solid #eee;text-align:center;cursor:pointer;' + intensity + '"' : ' style="padding:4px 8px;border:1px solid #eee;text-align:center;' + intensity + '"';
                        html += '<td' + clickAttr + '>' + (val || '') + '</td>';
                    });
                    var totalClick = rowTotal > 0 ? ' data-hm-click="1" data-hm-type="' + t + '" data-hm-complexity="" data-hm-sheet="' + sheet + '" title="Click to view all ' + t + ' items" style="padding:4px 8px;border:1px solid #eee;text-align:center;font-weight:700;cursor:pointer"' : ' style="padding:4px 8px;border:1px solid #eee;text-align:center;font-weight:700"';
                    html += '<td' + totalClick + '>' + rowTotal + '</td></tr>';
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

            var that2 = that;
            container.querySelectorAll('[data-hm-click]').forEach(function (el) {
                el.addEventListener('click', function () {
                    that2._onHeatmapCellClick(el.dataset.hmType, el.dataset.hmComplexity, el.dataset.hmSheet);
                });
            });
        },

        _onHeatmapCellClick: function (typeLabel, complexity, sheetCode) {
            this._pendingTypeFilter = typeLabel;
            this._pendingComplexityFilter = complexity || "";
            var tabs = this.byId("sheetTabs");
            tabs.setSelectedKey(sheetCode);
            this._sheetType = sheetCode;
            this._switchTab(sheetCode);
        },

        _sectionTitle: function (text) {
            return '<div style="font-weight:600;margin-bottom:8px;font-size:14px;color:var(--sapTextColor, #333)">' + text + '</div>';
        },

        _hBar: function (label, value, max, color, suffix, labelWidth) {
            var pct = Math.max(Math.round(value / (max || 1) * 100), 2);
            var w = labelWidth || 100;
            return '<div style="display:flex;align-items:center;margin-bottom:4px;font-size:12px">' +
                '<div style="width:' + w + 'px;text-align:right;padding-right:8px;color:#555;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="' + label + '">' + label + '</div>' +
                '<div style="flex:1;background:#e8e8e8;border-radius:3px;height:20px">' +
                '<div style="width:' + pct + '%;background:' + color + ';border-radius:3px;height:100%"></div></div>' +
                '<div style="width:auto;min-width:80px;padding-left:8px;color:var(--sapTextColor, #333);font-weight:500;white-space:nowrap">' + suffix + '</div></div>';
        },

        _kpiTile: function (title, value, subtitle, color) {
            return '<div style="background:var(--sapTile_Background, #fff);border-left:4px solid ' + color + ';border-radius:4px;padding:12px 16px;min-width:160px;box-shadow:0 1px 3px rgba(0,0,0,0.12)">' +
                '<div style="font-size:12px;color:var(--sapContent_LabelColor, #666);margin-bottom:4px">' + title + '</div>' +
                '<div style="font-size:22px;font-weight:700;color:' + color + '">' + value + '</div>' +
                '<div style="font-size:11px;color:#888;margin-top:2px">' + subtitle + '</div></div>';
        },

        _fmtNum: function (n) {
            return n != null ? n.toLocaleString() : '0';
        },

        // --- Snapshots ---

        _loadSnapshots: function () {
            var that = this;
            this.getOwnerComponent().api("GET",
                "/projects/" + this._projectId + "/snapshots"
            ).then(function (data) {
                that.getView().getModel("snapshots").setData(data);
                var container = document.getElementById("compareContainer");
                if (container) container.innerHTML = "";
            });
        },

        onTakeSnapshot: function () {
            var that = this;
            var oPhaseSelect = new sap.m.Select({
                items: [
                    new sap.ui.core.Item({ key: "PREP", text: "PREP" }),
                    new sap.ui.core.Item({ key: "FTS", text: "FTS" }),
                    new sap.ui.core.Item({ key: "DESIGN", text: "DESIGN" }),
                    new sap.ui.core.Item({ key: "BUILD", text: "BUILD" }),
                    new sap.ui.core.Item({ key: "SIT/UAT", text: "SIT/UAT" }),
                    new sap.ui.core.Item({ key: "DEP", text: "DEP" }),
                    new sap.ui.core.Item({ key: "HYP", text: "HYP" }),
                    new sap.ui.core.Item({ key: "PRESALE", text: "PRESALE" }),
                    new sap.ui.core.Item({ key: "DISCOVERY", text: "DISCOVERY" })
                ]
            });
            var oLabelInput = new sap.m.Input({ placeholder: "e.g. Before client review" });

            var dialog = new Dialog({
                title: "Take Snapshot",
                type: "Message",
                content: new SimpleForm({
                    editable: true,
                    content: [
                        new Label({ text: "Phase" }), oPhaseSelect,
                        new Label({ text: "Label (optional)" }), oLabelInput
                    ]
                }),
                beginButton: new Button({
                    text: "Snapshot", type: "Emphasized",
                    press: function () {
                        that.getOwnerComponent().api("POST",
                            "/projects/" + that._projectId + "/snapshots", {
                                phase: oPhaseSelect.getSelectedKey(),
                                label: oLabelInput.getValue().trim()
                            }
                        ).then(function () {
                            that._showConfirmStrip("Snapshot saved — " + oPhaseSelect.getSelectedKey() + (oLabelInput.getValue().trim() ? " (" + oLabelInput.getValue().trim() + ")" : ""), "Success");
                            dialog.close();
                            if (that._sheetType === "SNAPSHOTS") that._loadSnapshots();
                        });
                    }
                }),
                endButton: new Button({ text: "Cancel", press: function () { dialog.close(); } }),
                afterClose: function () { dialog.destroy(); }
            });
            dialog.open();
        },

        onDeleteSnapshot: function (oEvent) {
            var obj = oEvent.getSource().getBindingContext("snapshots").getObject();
            var that = this;
            MessageBox.confirm("Delete snapshot '" + obj.phase + (obj.label ? " - " + obj.label : "") + "'?", {
                onClose: function (action) {
                    if (action === MessageBox.Action.OK) {
                        that.getOwnerComponent().api("DELETE",
                            "/projects/" + that._projectId + "/snapshots/" + obj.id
                        ).then(function () {
                            that._showConfirmStrip("Snapshot deleted", "Warning");
                            that._loadSnapshots();
                        });
                    }
                }
            });
        },

        onCompareSnapshot: function () {
            var item = this.byId("snapshotTable").getSelectedItem();
            if (!item) {
                MessageToast.show("Select a snapshot to compare");
                return;
            }
            var snap = item.getBindingContext("snapshots").getObject();
            var that = this;
            this.getOwnerComponent().api("GET",
                "/projects/" + this._projectId + "/compare/" + snap.id
            ).then(function (diff) {
                that._renderCompare(diff);
            });
        },

        _renderCompare: function (diff) {
            var container = document.getElementById("compareContainer");
            if (!container) return;
            var that = this;
            var snap = diff.snapshot;
            var html = '';

            html += '<div style="margin-top:16px">';
            html += '<div style="font-size:16px;font-weight:700;margin-bottom:12px;color:var(--sapTextColor, #333)">Comparison: Current vs Snapshot "' +
                snap.phase + (snap.label ? ' - ' + snap.label : '') + '" (' + snap.created_at + ')</div>';

            // KPI delta
            var cm = diff.currentMeta, pm = diff.previousMeta;
            html += '<div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:20px">';
            html += that._deltaTile("Total Hours", cm.totalHours, pm.totalHours, "h");
            html += that._deltaTile("Items", cm.totalItems, pm.totalItems, "");
            html += that._deltaTile("Func Hours", cm.totalFunc, pm.totalFunc, "h");
            html += that._deltaTile("Tech Hours", cm.totalTech, pm.totalTech, "h");
            html += '</div>';

            // Control section changes
            var cd = diff.controlDiff;
            var hasControlChanges = cd.factors || cd.phases || cd.funcPhasePct || cd.pgo || cd.contingency || cd.scopeConfig || cd.sheetFuncPct || cd.fixedRoles;
            if (hasControlChanges) {
                html += that._sectionTitle("Control Section Changes");
                html += '<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px">';
                html += '<tr style="background:#f2f2f2;font-weight:600">';
                html += '<td style="padding:5px 8px;border-bottom:2px solid #ccc">Section</td>';
                html += '<td style="padding:5px 8px;border-bottom:2px solid #ccc">Field</td>';
                html += '<td style="padding:5px 8px;border-bottom:2px solid #ccc;text-align:right">Current</td>';
                html += '<td style="padding:5px 8px;border-bottom:2px solid #ccc;text-align:right">Snapshot</td>';
                html += '<td style="padding:5px 8px;border-bottom:2px solid #ccc;text-align:right">Delta</td></tr>';

                var sections = [
                    { key: "factors", label: "Item Factors" },
                    { key: "phases", label: "Phase Weeks" },
                    { key: "funcPhasePct", label: "FUNC Phase %" },
                    { key: "pgo", label: "PGO %" },
                    { key: "contingency", label: "Contingency %" },
                    { key: "scopeConfig", label: "Scope Config" }
                ];
                sections.forEach(function (sec) {
                    if (!cd[sec.key]) return;
                    Object.keys(cd[sec.key]).forEach(function (field) {
                        var c = cd[sec.key][field];
                        html += that._diffRow(sec.label, field, c.current, c.previous);
                    });
                });

                if (cd.sheetFuncPct) {
                    Object.keys(cd.sheetFuncPct).forEach(function (key) {
                        var parts = key.split("|");
                        var sheet = parts[0] || key;
                        var grid = parts[1] === "BLUE" ? "Blue Grid" : "Orange Grid";
                        Object.keys(cd.sheetFuncPct[key]).forEach(function (field) {
                            var c = cd.sheetFuncPct[key][field];
                            html += that._diffRow(sheet + " — " + grid + " FUNC %", field, c.current, c.previous);
                        });
                    });
                }
                if (cd.fixedRoles) {
                    Object.keys(cd.fixedRoles).forEach(function (key) {
                        var parts = key.split("|");
                        var team = parts[0] || "";
                        var roleName = parts[1] || key;
                        var grid = parts[2] === "BLUE" ? "Blue Grid" : "Orange Grid";
                        Object.keys(cd.fixedRoles[key]).forEach(function (field) {
                            var c = cd.fixedRoles[key][field];
                            html += that._diffRow(team + " — " + grid + " — " + roleName, field, c.current, c.previous);
                        });
                    });
                }
                html += '</table>';
            }

            // Scope item changes
            var sd = diff.scopeDiff;
            if (sd.added.length > 0 || sd.removed.length > 0 || sd.changed.length > 0) {
                html += that._sectionTitle("Scope Item Changes");
                if (sd.added.length > 0) {
                    html += '<div style="margin-bottom:8px;font-size:12px"><span style="color:#1a6e3a;font-weight:600">Added (' + sd.added.length + '):</span> ';
                    html += sd.added.map(function (s) { return s.func_role + ' / ' + s.lob; }).join(', ');
                    html += '</div>';
                }
                if (sd.removed.length > 0) {
                    html += '<div style="margin-bottom:8px;font-size:12px"><span style="color:#bb0000;font-weight:600">Removed (' + sd.removed.length + '):</span> ';
                    html += sd.removed.map(function (s) { return s.func_role + ' / ' + s.lob; }).join(', ');
                    html += '</div>';
                }
                if (sd.changed.length > 0) {
                    html += '<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px">';
                    html += '<tr style="background:#f2f2f2;font-weight:600">';
                    html += '<td style="padding:5px 8px;border-bottom:2px solid #ccc">Scope Item</td>';
                    html += '<td style="padding:5px 8px;border-bottom:2px solid #ccc">Field</td>';
                    html += '<td style="padding:5px 8px;border-bottom:2px solid #ccc;text-align:right">Current</td>';
                    html += '<td style="padding:5px 8px;border-bottom:2px solid #ccc;text-align:right">Snapshot</td>';
                    html += '<td style="padding:5px 8px;border-bottom:2px solid #ccc;text-align:right">Delta</td></tr>';
                    sd.changed.forEach(function (c) {
                        Object.keys(c.changes).forEach(function (field) {
                            var ch = c.changes[field];
                            html += that._diffRow(c.key.replace("|", " / "), field, ch.current, ch.previous);
                        });
                    });
                    html += '</table>';
                }
            }

            // Item changes
            var id = diff.itemDiff;
            html += that._sectionTitle("Item Changes (" +
                id.changed.length + " changed, " + id.added.length + " added, " + id.removed.length + " removed)");

            if (id.added.length > 0) {
                html += '<div style="margin-bottom:8px"><span style="font-size:12px;color:#1a6e3a;font-weight:600">Added Items (' + id.added.length + '):</span></div>';
                html += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px;font-size:11px">';
                id.added.forEach(function (a) {
                    html += '<span style="background:#e6f4ea;padding:2px 8px;border-radius:3px;border:1px solid #b7e1cd">' + a.ricef_number + '</span>';
                });
                html += '</div>';
            }
            if (id.removed.length > 0) {
                html += '<div style="margin-bottom:8px"><span style="font-size:12px;color:#bb0000;font-weight:600">Removed Items (' + id.removed.length + '):</span></div>';
                html += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px;font-size:11px">';
                id.removed.forEach(function (r) {
                    html += '<span style="background:#fce8e6;padding:2px 8px;border-radius:3px;border:1px solid #f5c6cb">' + r.ricef_number + '</span>';
                });
                html += '</div>';
            }

            if (id.changed.length > 0) {
                html += '<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px">';
                html += '<tr style="background:#f2f2f2;font-weight:600">';
                html += '<td style="padding:5px 8px;border-bottom:2px solid #ccc">RICEF #</td>';
                html += '<td style="padding:5px 8px;border-bottom:2px solid #ccc">Description</td>';
                html += '<td style="padding:5px 8px;border-bottom:2px solid #ccc">Field</td>';
                html += '<td style="padding:5px 8px;border-bottom:2px solid #ccc;text-align:right">Current</td>';
                html += '<td style="padding:5px 8px;border-bottom:2px solid #ccc;text-align:right">Snapshot</td>';
                html += '<td style="padding:5px 8px;border-bottom:2px solid #ccc;text-align:right">Delta</td></tr>';
                id.changed.forEach(function (item) {
                    var fields = Object.keys(item.changes);
                    fields.forEach(function (field, fi) {
                        var c = item.changes[field];
                        html += '<tr>';
                        if (fi === 0) {
                            html += '<td style="padding:4px 8px;border-bottom:1px solid #eee;font-weight:500" rowspan="' + fields.length + '">' + item.ricef_number + '</td>';
                            html += '<td style="padding:4px 8px;border-bottom:1px solid #eee;font-size:11px" rowspan="' + fields.length + '">' + (item.description || '').substring(0, 50) + '</td>';
                        }
                        var cur = c.current != null ? c.current : '';
                        var prev = c.previous != null ? c.previous : '';
                        var delta = '';
                        if (typeof cur === 'number' && typeof prev === 'number') {
                            var d = Math.round((cur - prev) * 100) / 100;
                            delta = d > 0 ? '<span style="color:#1a6e3a">+' + that._fmtNum(d) + '</span>' :
                                    d < 0 ? '<span style="color:#bb0000">' + that._fmtNum(d) + '</span>' : '0';
                        }
                        html += '<td style="padding:4px 8px;border-bottom:1px solid #eee">' + field + '</td>';
                        html += '<td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:500">' + that._fmtVal(cur) + '</td>';
                        html += '<td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;color:#888">' + that._fmtVal(prev) + '</td>';
                        html += '<td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600">' + delta + '</td>';
                        html += '</tr>';
                    });
                });
                html += '</table>';
            }

            if (id.changed.length === 0 && id.added.length === 0 && id.removed.length === 0) {
                html += '<div style="font-size:12px;color:#888;padding:8px 0">No item changes detected.</div>';
            }

            // Calculated impact — side-by-side
            var curCalc = diff.currentCalculated;
            var prevCalc = diff.previousCalculated;
            var calc = diff.calculatedDiff;
            if (calc || (curCalc && prevCalc)) {
                html += '<div style="margin-top:16px;padding:12px;background:#f8f0e0;border-left:4px solid #e76500;border-radius:4px">';
                html += that._sectionTitle("Calculated Impact");

                // Summary totals as KPI tiles
                if (calc && calc.summaryTotals) {
                    html += '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px">';
                    var totalLabels = { totalFunc: "Total FUNC", totalTech: "Total TECH", totalPgo: "Total PGO", totalGrand: "Grand Total", itemCount: "Item Count" };
                    var totalUnits = { totalFunc: "h", totalTech: "h", totalPgo: "h", totalGrand: "h", itemCount: "" };
                    Object.keys(calc.summaryTotals).forEach(function (f) {
                        var c = calc.summaryTotals[f];
                        html += that._deltaTile(totalLabels[f] || f, c.current, c.previous, totalUnits[f] || "");
                    });
                    html += '</div>';
                }

                // Side-by-side grids
                if (curCalc && prevCalc) {
                    var P = ['prep', 'fts', 'design', 'build', 'sit_uat', 'dep', 'hyp'];
                    var PL = ['PREP', 'FTS', 'DESIGN', 'BUILD', 'SIT/UAT', 'DEP', 'HYP'];
                    var bdr = '1px solid #ddd';

                    html += '<div style="display:flex;gap:0;margin-bottom:4px">';
                    html += '<div style="flex:1;text-align:center;font-size:15px;font-weight:700;color:#0854a0;padding:8px 0">CURRENT</div>';
                    html += '<div style="width:2px"></div>';
                    html += '<div style="flex:1;text-align:center;font-size:15px;font-weight:700;color:#888;padding:8px 0">SNAPSHOT</div>';
                    html += '</div>';

                    function buildSideBySideGrid(title, curRows, prevRows) {
                        if ((!curRows || curRows.length === 0) && (!prevRows || prevRows.length === 0)) return;
                        var prevMap = {};
                        (prevRows || []).forEach(function (r) { prevMap[r.role] = r; });
                        var curMap = {};
                        (curRows || []).forEach(function (r) { curMap[r.role] = r; });
                        var allRoles = [];
                        var seen = {};
                        (curRows || []).concat(prevRows || []).forEach(function (r) {
                            if (!seen[r.role]) { allRoles.push(r.role); seen[r.role] = true; }
                        });

                        html += '<div style="font-weight:600;font-size:12px;margin:12px 0 4px;color:#e76500">' + title + '</div>';
                        html += '<div style="display:flex;gap:0;overflow-x:auto">';

                        function cellStyle(v, pv, isTotal) {  // eslint-disable-line no-inner-declarations
                            var changed = v !== pv;
                            var bg = changed ? (v > pv ? 'background:#e6f4ea' : 'background:#fce8e6') : '';
                            var fw = changed || isTotal ? 'font-weight:700' : '';
                            return bg + ';' + fw;
                        }
                        function deltaTag(v, pv) {
                            var d = v - pv;
                            if (d === 0) return '';
                            var color = d > 0 ? '#1a6e3a' : '#bb0000';
                            var sign = d > 0 ? '+' : '';
                            return '<div style="font-size:9px;color:' + color + ';font-weight:600">' + sign + d + '</div>';
                        }

                        // Current (left)
                        html += '<div style="flex:1;min-width:420px;padding-right:8px">';
                        html += '<table style="width:100%;border-collapse:collapse;font-size:11px">';
                        html += '<tr style="background:#e0ecf8"><th style="padding:3px 6px;border:' + bdr + ';text-align:left">Role</th>';
                        PL.forEach(function (l) { html += '<th style="padding:3px 4px;border:' + bdr + ';text-align:center">' + l + '</th>'; });
                        html += '<th style="padding:3px 4px;border:' + bdr + ';text-align:right;font-weight:700">TOTAL</th></tr>';
                        allRoles.forEach(function (role) {
                            var r = curMap[role];
                            var prev = prevMap[role];
                            html += '<tr>';
                            html += '<td style="padding:2px 6px;border:' + bdr + ';font-weight:500;font-size:10px;white-space:nowrap">' + role + '</td>';
                            P.forEach(function (p) {
                                var v = r ? (r[p] || 0) : 0;
                                var pv = prev ? (prev[p] || 0) : 0;
                                html += '<td style="padding:2px 4px;border:' + bdr + ';text-align:center;' + cellStyle(v, pv, false) + '">' + (v || '') + (v !== pv ? deltaTag(v, pv) : '') + '</td>';
                            });
                            var t = r ? (r.total || 0) : 0;
                            var pt = prev ? (prev.total || 0) : 0;
                            html += '<td style="padding:2px 4px;border:' + bdr + ';text-align:right;' + cellStyle(t, pt, true) + '">' + (t || '') + (t !== pt ? deltaTag(t, pt) : '') + '</td>';
                            html += '</tr>';
                        });
                        html += '</table></div>';

                        // Divider
                        html += '<div style="width:2px;background:#333;flex-shrink:0"></div>';

                        // Snapshot (right)
                        html += '<div style="flex:1;min-width:420px;padding-left:8px">';
                        html += '<table style="width:100%;border-collapse:collapse;font-size:11px">';
                        html += '<tr style="background:#f2f2f2"><th style="padding:3px 6px;border:' + bdr + ';text-align:left">Role</th>';
                        PL.forEach(function (l) { html += '<th style="padding:3px 4px;border:' + bdr + ';text-align:center">' + l + '</th>'; });
                        html += '<th style="padding:3px 4px;border:' + bdr + ';text-align:right;font-weight:700">TOTAL</th></tr>';
                        allRoles.forEach(function (role) {
                            var r = prevMap[role];
                            var cur = curMap[role];
                            html += '<tr>';
                            html += '<td style="padding:2px 6px;border:' + bdr + ';font-weight:500;font-size:10px;white-space:nowrap;color:var(--sapContent_LabelColor, #666)">' + role + '</td>';
                            P.forEach(function (p) {
                                var v = r ? (r[p] || 0) : 0;
                                var cv = cur ? (cur[p] || 0) : 0;
                                var changed = v !== cv;
                                var bg = changed ? 'background:#fff3cd' : '';
                                var fw = changed ? 'font-weight:700' : '';
                                html += '<td style="padding:2px 4px;border:' + bdr + ';text-align:center;color:var(--sapContent_LabelColor, #666);' + bg + ';' + fw + '">' + (v || '') + '</td>';
                            });
                            var t = r ? (r.total || 0) : 0;
                            var ct = cur ? (cur.total || 0) : 0;
                            var tChanged = t !== ct;
                            html += '<td style="padding:2px 4px;border:' + bdr + ';text-align:right;font-weight:700;color:var(--sapContent_LabelColor, #666);' + (tChanged ? 'background:#fff3cd' : '') + '">' + (t || '') + '</td>';
                            html += '</tr>';
                        });
                        html += '</table></div>';

                        html += '</div>';
                    }

                    ['RICEF', 'BI', 'MIGRATION'].forEach(function (sheet) {
                        var cg = (curCalc.orangeGrid || {})[sheet] || {};
                        var pg = (prevCalc.orangeGrid || {})[sheet] || {};
                        if ((cg.funcRows && cg.funcRows.length) || (pg.funcRows && pg.funcRows.length)) {
                            buildSideBySideGrid(sheet + ' — Orange Grid FUNC', cg.funcRows, pg.funcRows);
                        }
                        if ((cg.techRows && cg.techRows.length) || (pg.techRows && pg.techRows.length)) {
                            buildSideBySideGrid(sheet + ' — Orange Grid TECH', cg.techRows, pg.techRows);
                        }
                    });

                    var cfe = curCalc.funcEffort || {};
                    var pfe = prevCalc.funcEffort || {};
                    buildSideBySideGrid('Functional Scope Effort', cfe.scopeEffort, pfe.scopeEffort);
                    buildSideBySideGrid('Technical Scope Effort', cfe.techScopeEffort, pfe.techScopeEffort);
                    buildSideBySideGrid('Total Functional Effort', cfe.totalEffort, pfe.totalEffort);

                    // Summary page sections
                    var csu = curCalc.summary || {};
                    var psu = prevCalc.summary || {};
                    buildSideBySideGrid('Summary — Project Phases', csu.phases, psu.phases);
                    buildSideBySideGrid('Summary — Architect', csu.funcArchitect, psu.funcArchitect);
                    buildSideBySideGrid('Summary — Functional Scope', csu.funcScope, psu.funcScope);
                    buildSideBySideGrid('Summary — Technical DEV', csu.techDev, psu.techDev);
                    buildSideBySideGrid('Summary — Technical BI', csu.techBi, psu.techBi);
                    buildSideBySideGrid('Summary — Technical Migration', csu.techMig, psu.techMig);
                }

                html += '</div>';
            }

            html += '</div>';
            container.innerHTML = html;
        },

        _deltaTile: function (title, current, previous, unit) {
            var delta = current - previous;
            var deltaStr = delta > 0 ? "+" + this._fmtNum(delta) : delta < 0 ? this._fmtNum(delta) : "0";
            var color = delta > 0 ? "#e76500" : delta < 0 ? "#1a6e3a" : "#666";
            var borderColor = delta !== 0 ? color : "#ccc";
            return '<div style="background:var(--sapTile_Background, #fff);border-left:4px solid ' + borderColor + ';border-radius:4px;padding:12px 16px;min-width:150px;box-shadow:0 1px 3px rgba(0,0,0,0.12)">' +
                '<div style="font-size:12px;color:var(--sapContent_LabelColor, #666);margin-bottom:4px">' + title + '</div>' +
                '<div style="font-size:20px;font-weight:700;color:var(--sapTextColor, #333)">' + this._fmtNum(current) + unit + '</div>' +
                '<div style="font-size:12px;color:' + color + ';font-weight:600;margin-top:2px">' + deltaStr + unit + ' from snapshot</div>' +
                '<div style="font-size:11px;color:#888">was ' + this._fmtNum(previous) + unit + '</div></div>';
        },

        _diffRow: function (section, field, current, previous) {
            var cur = current != null ? current : '';
            var prev = previous != null ? previous : '';
            var delta = '';
            if (typeof cur === 'number' && typeof prev === 'number') {
                var d = Math.round((cur - prev) * 10000) / 10000;
                delta = d > 0 ? '<span style="color:#e76500">+' + d + '</span>' :
                        d < 0 ? '<span style="color:#1a6e3a">' + d + '</span>' : '0';
            } else {
                delta = cur !== prev ? '<span style="color:#e76500">changed</span>' : '';
            }
            var bg = delta ? 'background:#fffbf0' : '';
            return '<tr style="' + bg + '">' +
                '<td style="padding:4px 8px;border-bottom:1px solid #eee;font-weight:500">' + section + '</td>' +
                '<td style="padding:4px 8px;border-bottom:1px solid #eee">' + field + '</td>' +
                '<td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:500">' + this._fmtVal(cur) + '</td>' +
                '<td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;color:#888">' + this._fmtVal(prev) + '</td>' +
                '<td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600">' + delta + '</td></tr>';
        },

        _fmtVal: function (v) {
            if (v == null || v === '') return '';
            if (typeof v === 'number') return this._fmtNum(Math.round(v * 10000) / 10000);
            return String(v);
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
                container.innerHTML = "<p style='padding:1rem;color:var(--sapContent_LabelColor, #666)'>No staffing data</p>";
                return;
            }

            var c = this._gc("purple");
            var dk = this._isDark();
            var phaseColors = dk
                ? { PREP: "#3d2050", FTS: "#352048", DESIGN: "#2d1a40", BUILD: "#281838", "SIT/UAT": "#221530", DEP: "#1d1228", HYP: "#180f20" }
                : { PREP: "#e8d0f0", FTS: "#d4b8e8", DESIGN: "#c8a8e0", BUILD: "#b890d8", "SIT/UAT": "#a878d0", DEP: "#9860c8", HYP: "#8848c0" };
            var bdr = "1px solid " + c.borderClr;
            var fixedRowBg = dk ? "#1a2a3a" : "#e0f0ff";
            var fixedCellBg = dk ? "#1e3040" : "#e8f4fd";
            var devCellBg = dk ? "#2a1e35" : "#f0e8f8";

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
            html += '<table class="effortGrid" style="border-collapse:collapse;font-size:12px;white-space:nowrap;color:' + c.textClr + '">';

            html += '<tr>';
            html += '<th colspan="5" style="background:' + c.hdrBg + ';color:#fff;padding:4px 8px;text-align:center">STAFFING</th>';
            phaseGroups.forEach(function (pg) {
                var bg = phaseColors[pg.phase] || c.borderClr;
                html += '<th colspan="' + pg.count + '" style="background:' + bg + ';padding:4px;text-align:center;border:' + bdr + ';font-weight:bold;color:' + (dk ? '#e0e0e0' : 'inherit') + '">' + pg.phase + '</th>';
            });
            html += '</tr>';

            html += '<tr style="background:' + c.subHdrBg + '">';
            html += '<th style="padding:3px 6px;border:' + bdr + ';min-width:30px">Type</th>';
            html += '<th style="padding:3px 6px;border:' + bdr + ';min-width:40px;text-align:right">%</th>';
            html += '<th style="padding:3px 6px;border:' + bdr + ';min-width:160px">Description</th>';
            html += '<th style="padding:3px 6px;border:' + bdr + ';min-width:30px;text-align:center">Req</th>';
            html += '<th style="padding:3px 6px;border:' + bdr + ';min-width:100px">Function</th>';
            data.weekCols.forEach(function (wc) {
                html += '<th style="padding:3px 4px;border:' + bdr + ';text-align:center;min-width:28px;background:' + c.subHdrBg + '">' + wc.phaseWeek + '</th>';
            });
            html += '</tr>';

            data.fixedRoles.forEach(function (fr) {
                html += '<tr style="background:' + fixedRowBg + ';font-weight:bold">';
                html += '<td style="padding:2px 6px;border:' + bdr + '"></td>';
                html += '<td style="padding:2px 6px;border:' + bdr + ';text-align:right">100%</td>';
                html += '<td style="padding:2px 6px;border:' + bdr + '">' + fr.role + '</td>';
                html += '<td style="padding:2px 6px;border:' + bdr + ';text-align:center">1</td>';
                html += '<td style="padding:2px 6px;border:' + bdr + '">' + fr.role + '</td>';
                fr.hours.forEach(function (h) {
                    var val = h ? h : '';
                    var bg = h ? fixedCellBg : '';
                    html += '<td style="padding:2px 4px;border:' + bdr + ';text-align:center;' + (bg ? 'background:' + bg : '') + '">' + val + '</td>';
                });
                html += '</tr>';
            });

            var lastRole = "";
            data.developers.forEach(function (dev) {
                var isNewRole = dev.role !== lastRole;
                lastRole = dev.role;
                var rowBg = isNewRole ? "background:" + c.highlightBg : "";
                html += '<tr style="' + rowBg + '">';
                html += '<td style="padding:2px 6px;border:' + bdr + ';font-weight:bold;color:' + c.hdrBg + '">' + dev.type + '.</td>';
                html += '<td style="padding:2px 6px;border:' + bdr + ';text-align:right">' + Math.round(dev.pct * 100) + '%</td>';
                html += '<td style="padding:2px 6px;border:' + bdr + ';font-size:11px">' + dev.description + '</td>';
                html += '<td style="padding:2px 6px;border:' + bdr + ';text-align:center">' + dev.numResources + '</td>';
                html += '<td style="padding:2px 6px;border:' + bdr + '">' + (isNewRole ? dev.role : '') + '</td>';
                dev.hours.forEach(function (h) {
                    var val = h ? h : '';
                    var bg = h ? devCellBg : '';
                    html += '<td style="padding:2px 4px;border:' + bdr + ';text-align:center;' + (bg ? 'background:' + bg : '') + '">' + val + '</td>';
                });
                html += '</tr>';
            });

            html += '</table></div>';
            container.innerHTML = html;
        },

        // --- Sheet control section (RICEF/BI/MIGRATION) ---

        _orangeGridData: null,

        _loadOrangeGrid: function (sheetType) {
            var that = this;
            this.getOwnerComponent().api("GET",
                "/projects/" + this._projectId + "/orange-grid/" + sheetType
            ).then(function (data) {
                that._orangeGridData = data;
                if (that.byId("orangeGridPanel").getExpanded()) {
                    that._renderOrangeGrid();
                }
            });
        },

        onOrangeGridExpand: function (oEvent) {
            var that = this;
            if (oEvent.getParameter("expand") && this._orangeGridData) {
                setTimeout(function () { that._renderOrangeGrid(); }, 50);
            }
        },

        onOrangeGridAfterRendering: function () {
            if (this._orangeGridData && this.byId("orangeGridPanel").getExpanded()) {
                this._renderOrangeGrid();
            }
        },

        _renderOrangeGrid: function () {
            var container = document.getElementById("orangeGridContainer");
            if (!container || !this._orangeGridData) return;
            var data = this._orangeGridData;
            var phases = ["prep", "fts", "design", "build", "sit_uat", "dep", "hyp"];
            var phaseLabels = ["PREP", "FTS", "DESIGN", "BUILD", "SIT/UAT", "DEP", "HYP"];
            var ph = data.phases || {};
            var dl = data.project ? data.project.delivery_level : 1;

            var c = this._gc("orange");

            var html = '<div style="overflow-x:auto;max-width:100%">';
            html += '<table class="effortGrid" style="border-collapse:collapse;font-size:12px;white-space:nowrap;width:100%;color:' + c.textClr + '">';

            html += '<tr><th colspan="9" style="background:' + c.hdrBg + ';color:' + c.hdrFg + ';padding:6px 10px;text-align:left;font-size:13px">';
            html += 'ORANGE GRID &nbsp;&nbsp;|&nbsp;&nbsp; Delivery Level: ' + dl;
            html += ' &nbsp;&nbsp;|&nbsp;&nbsp; Phases: ';
            phaseLabels.forEach(function (lbl, i) {
                var key = phases[i];
                html += lbl + ' ' + (ph[key] || 0) + (i < 6 ? ' | ' : '');
            });
            html += ' weeks</th></tr>';

            html += '<tr><td colspan="9" style="background:' + c.sectionBg + ';color:#fff;padding:4px 10px;font-weight:bold;border:' + c.cellBorder + '">FUNC — Functional Effort</td></tr>';
            html += '<tr style="background:' + c.subHdrBg + '">';
            html += '<th style="padding:4px 8px;border:' + c.cellBorder + ';text-align:left;min-width:180px">Role</th>';
            phaseLabels.forEach(function (lbl) {
                html += '<th style="padding:4px 8px;border:' + c.cellBorder + ';text-align:center;min-width:60px">' + lbl + '</th>';
            });
            html += '<th style="padding:4px 8px;border:' + c.cellBorder + ';text-align:right;min-width:70px;font-weight:bold">TOTAL</th></tr>';

            (data.funcRows || []).forEach(function (r, idx) {
                var bg = idx % 2 === 0 ? c.rowBg1 : c.rowBg2;
                html += '<tr style="background:' + bg + '">';
                html += '<td style="padding:3px 8px;border:' + c.cellBorder + ';font-weight:500">' + (r.role || '') + '</td>';
                var rowTotal = 0;
                phases.forEach(function (p) {
                    var v = r[p] || 0;
                    rowTotal += v;
                    html += '<td style="padding:3px 8px;border:' + c.cellBorder + ';text-align:center">' + (v ? Math.round(v) : '') + '</td>';
                });
                html += '<td style="padding:3px 8px;border:' + c.cellBorder + ';text-align:right;font-weight:bold">' + (rowTotal ? Math.round(rowTotal) : '') + '</td>';
                html += '</tr>';
            });

            html += '<tr><td colspan="9" style="background:' + c.sectionBg + ';color:#fff;padding:4px 10px;font-weight:bold;border:' + c.cellBorder + '">TECH — Technical Effort</td></tr>';
            html += '<tr style="background:' + c.subHdrBg + '">';
            html += '<th style="padding:4px 8px;border:' + c.cellBorder + ';text-align:left">Role</th>';
            phaseLabels.forEach(function (lbl) {
                html += '<th style="padding:4px 8px;border:' + c.cellBorder + ';text-align:center">' + lbl + '</th>';
            });
            html += '<th style="padding:4px 8px;border:' + c.cellBorder + ';text-align:right;font-weight:bold">TOTAL</th></tr>';

            (data.techRows || []).forEach(function (r, idx) {
                var isHighlight = r._highlight;
                var bg = isHighlight ? c.highlightBg : (idx % 2 === 0 ? c.rowBg1 : c.rowBg2);
                var fw = isHighlight ? 'font-weight:bold' : '';
                html += '<tr style="background:' + bg + ';' + fw + '">';
                html += '<td style="padding:3px 8px;border:' + c.cellBorder + ';font-weight:500">' + (r.role || '') + '</td>';
                var rowTotal = 0;
                phases.forEach(function (p) {
                    var v = r[p] || 0;
                    rowTotal += v;
                    html += '<td style="padding:3px 8px;border:' + c.cellBorder + ';text-align:center">' + (v ? Math.round(v) : '') + '</td>';
                });
                html += '<td style="padding:3px 8px;border:' + c.cellBorder + ';text-align:right;font-weight:bold">' + (rowTotal ? Math.round(rowTotal) : '') + '</td>';
                html += '</tr>';
            });

            html += '</table></div>';
            container.innerHTML = html;
        },

        // --- Blue Grid (Customer) ---

        _blueGridData: null,

        _loadBlueGrid: function (sheetType) {
            var that = this;
            this.getOwnerComponent().api("GET",
                "/projects/" + this._projectId + "/blue-grid/" + sheetType
            ).then(function (data) {
                that._blueGridData = data;
                if (that.byId("blueGridPanel").getExpanded()) {
                    that._renderBlueGrid();
                }
            });
        },

        onBlueGridExpand: function (oEvent) {
            var that = this;
            if (oEvent.getParameter("expand") && this._blueGridData) {
                setTimeout(function () { that._renderBlueGrid(); }, 50);
            }
        },

        onBlueGridAfterRendering: function () {
            if (this._blueGridData && this.byId("blueGridPanel").getExpanded()) {
                this._renderBlueGrid();
            }
        },

        _renderBlueGrid: function () {
            var container = document.getElementById("blueGridContainer");
            if (!container || !this._blueGridData) return;
            var data = this._blueGridData;
            var phases = ["prep", "fts", "design", "build", "sit_uat", "dep", "hyp"];
            var phaseLabels = ["PREP", "FTS", "DESIGN", "BUILD", "SIT/UAT", "DEP", "HYP"];
            var ph = data.phases || {};
            var dl = data.project ? data.project.delivery_level : 1;

            var c = this._gc("blue");

            var html = '<div style="overflow-x:auto;max-width:100%">';
            html += '<table class="effortGrid" style="border-collapse:collapse;font-size:12px;white-space:nowrap;width:100%;color:' + c.textClr + '">';

            html += '<tr><th colspan="9" style="background:' + c.hdrBg + ';color:' + c.hdrFg + ';padding:6px 10px;text-align:left;font-size:13px">';
            html += 'BLUE GRID (Customer) &nbsp;&nbsp;|&nbsp;&nbsp; Delivery Level: ' + dl;
            html += ' &nbsp;&nbsp;|&nbsp;&nbsp; Phases: ';
            phaseLabels.forEach(function (lbl, i) {
                html += lbl + ' ' + (ph[phases[i]] || 0) + (i < 6 ? ' | ' : '');
            });
            html += ' weeks</th></tr>';

            html += '<tr><td colspan="9" style="background:' + c.sectionBg + ';color:#fff;padding:4px 10px;font-weight:bold;border:' + c.cellBorder + '">FUNC — Functional Effort (Customer)</td></tr>';
            html += '<tr style="background:' + c.subHdrBg + '">';
            html += '<th style="padding:4px 8px;border:' + c.cellBorder + ';text-align:left;min-width:180px">Role</th>';
            phaseLabels.forEach(function (lbl) {
                html += '<th style="padding:4px 8px;border:' + c.cellBorder + ';text-align:center;min-width:60px">' + lbl + '</th>';
            });
            html += '<th style="padding:4px 8px;border:' + c.cellBorder + ';text-align:right;min-width:70px;font-weight:bold">TOTAL</th></tr>';

            (data.funcRows || []).forEach(function (r, idx) {
                var bg = idx % 2 === 0 ? c.rowBg1 : c.rowBg2;
                html += '<tr style="background:' + bg + '">';
                html += '<td style="padding:3px 8px;border:' + c.cellBorder + ';font-weight:500">' + (r.role || '') + '</td>';
                var rowTotal = 0;
                phases.forEach(function (p) {
                    var v = r[p] || 0;
                    rowTotal += v;
                    html += '<td style="padding:3px 8px;border:' + c.cellBorder + ';text-align:center">' + (v ? Math.round(v) : '') + '</td>';
                });
                html += '<td style="padding:3px 8px;border:' + c.cellBorder + ';text-align:right;font-weight:bold">' + (rowTotal ? Math.round(rowTotal) : '') + '</td>';
                html += '</tr>';
            });

            if (!data.funcRows || data.funcRows.length === 0) {
                html += '<tr><td colspan="9" style="padding:6px 8px;border:' + c.cellBorder + ';color:#888;text-align:center;font-style:italic">No CUSTOMER functional items on this sheet</td></tr>';
            }

            html += '<tr><td colspan="9" style="background:' + c.sectionBg + ';color:#fff;padding:4px 10px;font-weight:bold;border:' + c.cellBorder + '">TECH — Technical Effort (Customer)</td></tr>';
            html += '<tr style="background:' + c.subHdrBg + '">';
            html += '<th style="padding:4px 8px;border:' + c.cellBorder + ';text-align:left">Role</th>';
            phaseLabels.forEach(function (lbl) {
                html += '<th style="padding:4px 8px;border:' + c.cellBorder + ';text-align:center">' + lbl + '</th>';
            });
            html += '<th style="padding:4px 8px;border:' + c.cellBorder + ';text-align:right;font-weight:bold">TOTAL</th></tr>';

            (data.techRows || []).forEach(function (r, idx) {
                var isHighlight = r._highlight;
                var bg = isHighlight ? c.highlightBg : (idx % 2 === 0 ? c.rowBg1 : c.rowBg2);
                var fw = isHighlight ? 'font-weight:bold' : '';
                html += '<tr style="background:' + bg + ';' + fw + '">';
                html += '<td style="padding:3px 8px;border:' + c.cellBorder + ';font-weight:500">' + (r.role || '') + '</td>';
                var rowTotal = 0;
                phases.forEach(function (p) {
                    var v = r[p] || 0;
                    rowTotal += v;
                    html += '<td style="padding:3px 8px;border:' + c.cellBorder + ';text-align:center">' + (v ? Math.round(v) : '') + '</td>';
                });
                html += '<td style="padding:3px 8px;border:' + c.cellBorder + ';text-align:right;font-weight:bold">' + (rowTotal ? Math.round(rowTotal) : '') + '</td>';
                html += '</tr>';
            });

            if (!data.techRows || data.techRows.length === 0) {
                html += '<tr><td colspan="9" style="padding:6px 8px;border:' + c.cellBorder + ';color:#888;text-align:center;font-style:italic">No CUSTOMER technical items on this sheet</td></tr>';
            }

            html += '</table></div>';
            container.innerHTML = html;
        },

        // --- Sheet control section (RICEF/BI/MIGRATION) ---

        _loadSheetControl: function (sheetCode, gridType) {
            var that = this;
            var gt = gridType || "ORANGE";
            this.getOwnerComponent().api("GET",
                "/projects/" + this._projectId + "/sheet-control/" + sheetCode + "?grid_type=" + gt
            ).then(function (data) {
                that._buildSheetControlTable(data, sheetCode, "sheetControlTable", "sheetCtrl", gt);
            });
        },

        _loadBlueSheetControl: function (sheetCode) {
            var that = this;
            this.getOwnerComponent().api("GET",
                "/projects/" + this._projectId + "/sheet-control/" + sheetCode + "?grid_type=BLUE"
            ).then(function (data) {
                that._buildSheetControlTable(data, sheetCode, "blueControlTable", "blueCtrl", "BLUE");
            });
        },

        _buildSheetControlTable: function (data, sheetCode, tableId, modelName, gridType) {
            var that = this;
            var table = this.byId(tableId);
            table.removeAllItems();

            formatter.pctToDisplay(data.funcPct);
            (data.fixedRoles || []).forEach(function (r) { formatter.fixedRolePctToDisplay(r); });

            var ColumnListItem = sap.m.ColumnListItem;
            var Text = sap.m.Text;
            var InputCtrl = sap.m.Input;
            var phases = ["prep", "fts", "design", "build", "sit_uat", "dep", "hyp"];
            var gridLabel = gridType === "BLUE" ? "Blue Grid" : "Orange Grid";

            // Row 1: FUNC % Explore vs Build
            if (data.funcPct) {
                var funcRow = new ColumnListItem();
                var funcLabel = new sap.m.HBox({ alignItems: "Center" });
                funcLabel.addItem(new Text({ text: "FUNC  % Explore vs Build" }));
                funcLabel.addItem(new sap.ui.core.Icon({ src: "sap-icon://hint", color: "#0854a0", tooltip: "How functional item hours split across DESIGN (Explore) and BUILD phases for this sheet (" + gridLabel + ").\nPREP-DEP should total ~100%. HYP is additive." }).addStyleClass("inlineHint"));
                funcLabel.addStyleClass("sapUiSmallMarginBegin");
                funcRow.addCell(funcLabel);
                var isEditable = !that.getView().getModel("viewModel").getProperty("/readonly");
                phases.forEach(function (p) {
                    var inp = new InputCtrl({
                        value: "{" + modelName + ">/funcPct/" + p + "}",
                        type: "Number", textAlign: "Center", editable: isEditable,
                        change: function () { that._saveSheetFuncPct(sheetCode, gridType); }
                    });
                    funcRow.addCell(inp);
                });
                table.addItem(funcRow);
            }

            // Fixed role rows
            (data.fixedRoles || []).forEach(function (role) {
                var roleRow = new ColumnListItem();
                var roleLabel = new sap.m.HBox({ alignItems: "Center" });
                roleLabel.addItem(new Text({ text: role.role_name }));
                roleLabel.addItem(new sap.ui.core.Icon({ src: "sap-icon://hint", color: "#0854a0", tooltip: "Fixed role hours per phase (hours/week).\nFed into the " + gridLabel + " TECH section and Summary." }).addStyleClass("inlineHint"));
                roleLabel.addStyleClass("sapUiSmallMarginBegin");
                roleRow.addCell(roleLabel);
                var isEdit = !that.getView().getModel("viewModel").getProperty("/readonly");
                phases.forEach(function (p) {
                    var idx = data.fixedRoles.indexOf(role);
                    var inp = new InputCtrl({
                        value: "{" + modelName + ">/fixedRoles/" + idx + "/" + p + "}",
                        type: "Number", textAlign: "Center", editable: isEdit,
                        change: function () { that._saveFixedRole(role.id, idx, modelName); }
                    });
                    roleRow.addCell(inp);
                });
                table.addItem(roleRow);
            });

            this.getView().setModel(new sap.ui.model.json.JSONModel(data), modelName);
        },

        _saveSheetFuncPct: function (sheetCode, gridType) {
            var that = this;
            var gt = gridType || "ORANGE";
            var mn = gt === "BLUE" ? "blueCtrl" : "sheetCtrl";
            if (this._sheetFuncTimer) clearTimeout(this._sheetFuncTimer);
            this._sheetFuncTimer = setTimeout(function () {
                var data = JSON.parse(JSON.stringify(that.getView().getModel(mn).getProperty("/funcPct")));
                formatter.pctFromDisplay(data);
                that.getOwnerComponent().api("PUT",
                    "/projects/" + that._projectId + "/sheet-control/" + sheetCode + "/func-pct?grid_type=" + gt, data
                ).then(function () {
                    MessageToast.show("Saved");
                    if (gt === "BLUE") { that._loadBlueGrid(that._sheetType); }
                    else { that._loadOrangeGrid(that._sheetType); }
                });
            }, 600);
        },

        _saveFixedRole: function (roleId, idx, modelName) {
            var that = this;
            var mn = modelName || "sheetCtrl";
            if (this._fixedRoleTimer) clearTimeout(this._fixedRoleTimer);
            this._fixedRoleTimer = setTimeout(function () {
                var data = JSON.parse(JSON.stringify(that.getView().getModel(mn).getProperty("/fixedRoles/" + idx)));
                formatter.fixedRolePctFromDisplay(data);
                that.getOwnerComponent().api("PUT",
                    "/projects/" + that._projectId + "/fixed-role/" + roleId, data
                ).then(function () {
                    MessageToast.show("Saved");
                    if (mn === "blueCtrl") { that._loadBlueGrid(that._sheetType); }
                    else { that._loadOrangeGrid(that._sheetType); }
                });
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
                    formatter.pctFromDisplay(data, ["architect_pct", "arch_prep", "arch_fts", "arch_design", "arch_build", "arch_sit_uat", "arch_dep", "arch_hyp"]);
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

        onExportPdf: function () {
            var url = "/api/projects/" + this._projectId + "/items-pdf?sheetType=" + this._sheetType;
            window.open(url, "_blank");
        },

        onFilterChange: function () {
            this._applyFilters();
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

        _showConfirmStrip: function (msg, type) {
            var strip = this.byId("actionConfirmStrip");
            strip.setText(msg);
            strip.setType(type || "Success");
            strip.setVisible(true);
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
                            that._showConfirmStrip(selected.length + " item(s) deleted", "Warning");
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
                that._showConfirmStrip(r.recalculated + " items recalculated successfully", "Success");
                if (that._sheetType === "FUNCTIONAL") {
                    that._loadScope();
                } else {
                    that._loadItems();
                }
            });
        },

        onHelp: function () {
            var helpMap = { RICEF: "items", BI: "items", MIGRATION: "items", FUNCTIONAL: "functional", ANALYTICS: "analytics", SNAPSHOTS: "snapshots" };
            helpDialog.show(helpMap[this._sheetType] || "items");
        },

        onNavSummary: function () {
            this.getOwnerComponent().getRouter().navTo("summary", { projectId: this._projectId });
        },

        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("home");
        }
    });
});
