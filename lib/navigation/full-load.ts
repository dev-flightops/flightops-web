/** A full page load to `path`, replacing this page in the history (#201).
 *  Unlike the router's soft navigation, it drops every request the page
 *  still has in flight. Its own module so tests can stand in for it. */
export function fullPageLoad(path: string): void {
  window.location.replace(path);
}
