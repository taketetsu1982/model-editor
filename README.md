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

### Variants

Branching a model in the editor moves the layer keys into a `_variants` array, so that several design options can live side by side in one file:

```json
{
  "_variants": [
    { "id": "a", "name": "Option A", "active": true, "objects": [], "views": [], "paneGraph": [], "screens": {} },
    { "id": "b", "name": "Option B", "objects": [], "views": [], "paneGraph": [], "screens": {} }
  ]
}
```

- The variant with `active: true` is the one currently shown on the canvas
- "Keep" expands the active variant back to the top level and drops `_variants`
- Once a single variant is left, `_variants` is removed and the file returns to its normal shape

## Usage

### 1. Start the editor

```bash
node editors/server.js path/to/product-model.json
```

The server binds to `127.0.0.1` only and prints its URL (`http://localhost:8765/`; it looks for a free port if 8765 is taken). Open that URL and the model loads on its own — edits are written straight back to the file, so there is no file picker and no permission dialog.

Alternatively, open the editor as a plain file:

```bash
open editors/editor.html
```

In this mode, connect a JSON file by dragging it onto the editor or picking it with the "Connect" button.

### 2. Edit and save

- Switch between the Object / Pane / Screen tabs to edit
- With Auto Save ON, changes are saved automatically
- `Cmd/Ctrl + S` saves manually

## Repository layout

```
.claude-plugin/
└── plugin.json              # Claude Code plugin manifest
editors/
├── editor.html              # the editor itself
├── server.js                # local server (serves the editor, reads/writes the model)
└── lib/
    ├── editor-base.css      # shared styles
    ├── shared.js            # shared helpers and constants
    ├── object-logic.js      # Object-specific logic
    ├── view-logic.js        # Pane-specific logic
    ├── variant-manager.js   # variant branching
    ├── file-io.js           # file I/O layer
    ├── server-core.js       # pure helpers for the server (no I/O)
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
