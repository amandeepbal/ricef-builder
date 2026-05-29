<!-- plugin:start -->
# SAP ABAP Development Environment

MCP server for SAP ABAP development via ADT (ABAP Development Tools).

## Critical Constraints

**Never call MCP tools directly.** Always use the appropriate skill below.

**Multi-system sessions supported.** All MCP tool calls accept an optional `_system` parameter (e.g., `_system: "S4H-DEV"`) to target a specific SAP system. If omitted, the active system from `~/.sap-systems/registry.json` is used. Each system gets its own isolated session — concurrent calls to the same or different systems are safe.

**2FA re-auth (auto-trigger).** When any MCP tool returns an error containing `AUTH_REQUIRED:`, do not ask the user for permission and do not apologize — session expiry is normal on 2FA-enforced IAS tenants. Just:

1. Call `Login`. If it returns `_meta.requires_2fa: true` with an `auth_session_id`, prompt the user inline: *"Your `<system>` session expired (this is normal — 2FA tenants re-auth every few hours). Please open your authenticator app and paste the current 6-digit code."*
2. When the user provides the code, call `SubmitOtp({ auth_session_id, otp })`.
3. Retry the original tool call that failed.

If `Login` returns `_meta.authenticated: true` directly (non-2FA tenant), just retry the original tool call. Do not bother the user.

## Installation

Install via Claude Code's plugin marketplace:

```
claude plugin marketplace add https://dev-genie-bb7e18.gitlab.io/marketplace.json
claude plugin install abap-development@sap-abap-marketplace
```

The plugin is delivered as the `@dev-genie/mcp-sap-abap` npm package (MCP server + skills + agents + slash commands + hooks bundled together) from this repo's GitLab npm registry. You will need an npm token to authenticate — Syntax engineers pull it from the team 1Password vault (the link is on the DevGenie entry in [Backstage](https://backstage.syncxl.com/)).

## Skills

| Need | Skill | When |
|------|-------|------|
| Create, modify, fetch ABAP objects | `abap-development` | Any SAP/ABAP/ADT/SE80/BTP/RAP work |
| Generate RAP Fiori apps | `abap-rap` | Fiori app, OData service, CRUD, draft-enabled |
| Adobe Forms with XDP layout | `abap-form` | Adobe form, PDF form, print form, XDP template, SFP |
| Technical design from functional spec | `abap-techdesign` | Technical design, FRICEW analysis, tech spec |
| Pull specs from SpecGenie, push back | `specgenie-connect` | `/pull-fs`, `/push-ts`, `/pull-ts`, `/update-status` |
| AFS-to-Fashion conversion tech design | `afs-techdesign` | AFS conversion, AFS migration, AFS to S4F |
| AFS remediation plans | `afs-remediation` | AFS remediation, AFS quick conversion, AFS code fix |
| AFS conversion estimation | `afs-estimation` | AFS estimation, conversion effort, complexity scoring |
| AFS bug diagnosis and fix | `afs-break-fix` | Bug fix, break fix, defect, troubleshoot, debug AFS code |
| SAP object cloudification status | `cloudification-lookup` | Clean Core compliance + API contract check by product/release |
| Switch SAP systems mid-session | `sap-system-manager` | `/sap-system`, connect, switch DEV/QAS/PRD |
| Screen capture + analysis | `screenshot` | Capture and analyze screen regions |

## Agents

| Agent | Purpose |
|-------|---------|
| `techdesign-researcher` | Batch compliance research (used by `abap-techdesign` Phase 3) |
| `techdesign-validator` | Live system validation + report assembly (used by `abap-techdesign` Phase 3) |
| `techdesign-qa` | Validation report QA audit (used by `abap-techdesign` Phase 3) |
| `afs-remediation-qa` | QA reviewer for AFS remediation plans |
| `estimation-worker` | Worker agent for AFS conversion estimation |

## ABAP Development Principles

- **Clean Core:** Prefer released APIs (Level A/B). Validate BAPIs/FMs against SAP's Cloudification Repository.
- **ABAP-SQL:** Leverage code pushdown. Prefer released CDS views over direct table access.
- **Data Elements:** Use SAP standard data elements, not raw types (`CHAR`, `NUMC`, `DEC`).

## Environment

- **Credentials:** `~/.sap-systems/` (managed via `/sap-system`)
- **System Cache:** `~/.sap-system-cache.json` (auto-refreshed on connect/switch)
<!-- plugin:end -->

<!-- Add project-specific rules below — preserved across plugin updates -->
