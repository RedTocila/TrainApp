/** Present in the HTML once a real screen has rendered, so the boot splash can leave. */
export function AppReady() {
  return <span data-app-ready="" hidden style={{ display: "none" }} />;
}
