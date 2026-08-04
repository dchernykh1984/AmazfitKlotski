// A stand-in for the Zepp OS widget system (@zos/ui).
//
// It records every widget the page creates and refuses to delete one twice or to
// delete something it never made, so the page's own widget bookkeeping is under
// test rather than assumed: a leak shows up as a widget still alive after the
// screen that owned it is gone, and a double free throws where it happens.

export const widget = {
  FILL_RECT: "FILL_RECT",
  STROKE_RECT: "STROKE_RECT",
  TEXT: "TEXT",
  BUTTON: "BUTTON",
  IMG: "IMG",
};

export const align = { CENTER_H: "CENTER_H", CENTER_V: "CENTER_V" };
export const text_style = { NONE: "NONE", WRAP: "WRAP" };
export const prop = { MORE: "MORE" };

let widgets = [];
let nextId = 1;

export function createWidget(type, props) {
  if (!Object.prototype.hasOwnProperty.call(widget, type)) {
    throw new Error(`unknown widget type ${type}`);
  }
  const created = {
    id: nextId++,
    type,
    props: { ...props },
    alive: true,
    setProperty(name, value) {
      if (name !== prop.MORE) {
        throw new Error(`unsupported property ${name}`);
      }
      Object.assign(this.props, value);
    },
  };
  widgets.push(created);
  return created;
}

export function deleteWidget(target) {
  if (!target || typeof target !== "object") {
    throw new Error("deleteWidget called without a widget");
  }
  if (widgets.indexOf(target) === -1) {
    throw new Error("deleteWidget called with a widget this screen never created");
  }
  if (!target.alive) {
    throw new Error(`widget ${target.id} (${target.type}) deleted twice`);
  }
  target.alive = false;
}

// ------------------------------------------------------------ test helpers ----

export function reset() {
  widgets = [];
  nextId = 1;
}

// Everything currently on screen, in the order it was drawn.
export function live() {
  return widgets.filter((created) => created.alive);
}

export function liveOfType(type) {
  return live().filter((created) => created.type === type);
}

// The live widgets that can be tapped, which is how a test presses a button.
export function buttons() {
  return live().filter((created) => typeof created.props.click_func === "function");
}

export function buttonWithText(text) {
  return buttons().find((created) => created.props.text === text) || null;
}

export function texts() {
  return liveOfType(widget.TEXT).map((created) => created.props.text);
}

export function hasText(text) {
  return texts().indexOf(text) !== -1;
}
