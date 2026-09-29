import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

import { resetDispatchQuery } from "@/components/dispatch/packet/dispatch-query";

afterEach(() => {
  cleanup();
  // Module state that chains the packet's URL changes; each test
  // renders a fresh packet.
  resetDispatchQuery();
});
