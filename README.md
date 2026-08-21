# Model Editor

An editor where AI and humans design a product's objects together, based on OOUI (Object-Oriented User Interface). AI decomposes your documents into three layers — objects (the data model), panes (the building blocks of screens), and screens (per-device pane composition) — and generates them. Everything is managed in a single JSON file and can be edited visually in the browser.

*[日本語版 (Japanese)](README.ja.md)*

## Overview

```
Example: a mail application

Object layer (Object tab)
  Mailbox ──*── Message
     :              :
- - - - - - - - - - - - - - - - - -
     :        *     :
Pane layer (Pane tab)
  Collection ──→ Collection ──→ Single
   (list view)    (list view)    (detail view)
     :              :              :
- - - - - - - - - - - - - - - - - -
     :              :              :
Screen layer (Screen tab)
  mobile:  [Collection]
  desktop: [Collection, Single]
```

- **Object tab** — define objects and their relations
- **Pane tab** — define panes (collection / single) and the Pane Graph (transitions)
- **Screen tab** — compose screens by grouping panes per device

## JSON structure

```json
{
  "devices": [],
  "objects": [],
  "views": [],
  "paneGraph": [],
  "screens": []
}
```

| Field | Tab | Description |
|---|---|---|
| `devices` | Screen | List of devices (array of strings) |
| `objects` | Object | Object definitions (name, relations) |
| `views` | Pane | Pane definitions (collection / single) |
| `paneGraph` | Pane | Pane Graph — edges between panes (drilldown / embed) |
| `screens` | Screen | Screen definitions (pane composition per device) |

## Usage

### 1. Open the editor

```bash
open editors/editor.html
```

### 2. Connect a JSON file

- Drag and drop a JSON file onto the editor
- Or pick one with the "Connect" button

### 3. Edit and save

- Switch between the Object / Pane / Screen tabs to edit
- With Auto Save ON, changes are saved automatically
- `Cmd/Ctrl + S` saves manually

## Repository layout

```
.claude-plugin/
└── plugin.json              # Claude Code plugin manifest
editors/
├── editor.html              # the editor itself
└── lib/
    ├── editor-base.css      # shared styles
    ├── shared.js            # shared helpers and constants
    ├── object-logic.js      # Object-specific logic
    ├── view-logic.js        # Pane-specific logic
    ├── file-io.js           # file I/O layer
    └── ui-components.js     # shared UI components
sample/
└── product-model.json       # sample data
skills/
├── generate/SKILL.md        # /generate skill definition
└── edit/SKILL.md            # /edit skill definition
```

> Test files (`*.test.js`) sit next to the logic files they cover.

## Tests

```bash
npx vitest run
```

## Claude Code plugin

This repository can be used as a Claude Code plugin.

### Local testing

```bash
claude --plugin-dir /path/to/model-editor
```

### Skills

| Skill | Description |
|---|---|
| `/generate` | Generate a full product model JSON from a PRD or similar document |
| `/edit` | Open the HTML editor in a browser and edit visually |

## License

[MIT License](LICENSE)
