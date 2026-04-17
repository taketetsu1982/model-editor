# Glossary

| Term | Definition |
|---|---|
| OOUI | Object-Oriented User Interface. A UI design methodology where users interact with domain Objects (nouns) rather than navigating function menus (verbs). The interaction follows a "noun → verb" paradigm: select an Object first, then choose an Action to perform on it. |
| Object | A domain entity that users perceive and act on. Has multiple instances sharing common properties and actions. The "noun" in the noun-verb interaction paradigm. |
| Property (Field) | An attribute of an Object displayed in a Pane (e.g., name, status, date). Stored as `fields` in JSON. |
| Action (Verb) | An operation performed on an Object (e.g., create, edit, delete). Stored as `verbs` in JSON. Actions are always placed on a Pane, never as standalone menu items. |
| Pane | The minimum display unit showing one Object in a specific format (Collection or Single). Not a screen — devices combine multiple Panes into one screen. Stored as `views` in JSON. |
| Collection | A Pane type that lists multiple instances of the same Object, showing key properties. |
| Single | A Pane type that displays one Object instance in detail, typically with more properties than a Collection. |
| View | In this project, the presentation layer as a whole — the set of all Panes. In JSON, `views` is the array containing Pane definitions. Note: OOUI literature uses "view" for individual display units; this project uses "Pane" for that concept instead. |
| Pane Graph | A graph defining relationships between Panes. Has two edge types: `drilldown` (directed, arrow — user navigates to another Pane, with `param` specifying the passed parameter) and `embed` (undirected, line — a Single Pane contains a child Collection). Independent of how Panes are grouped into Screens. Stored as `paneGraph` in JSON. |
| Device | A target device type (e.g., "mobile", "desktop"). Stored as `devices` string array in JSON. Screens reference a device from this list. |
| Screen | A device-specific grouping of one or more Panes into a single screen. The same logical screen (e.g., "Home") can have different Pane compositions per device. Stored as `screens` in JSON. |
| Relation | A directional association between Objects (parent → child). Defined only in one direction to avoid duplicate lines. |
