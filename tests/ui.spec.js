import { test, expect } from "@playwright/test";

const record = {
  id: "11111111-1111-4111-8111-111111111111",
  payload: {
    kind: "alumni",
    title: "Python mentor",
    description:
      "An alumnus who helps students build machine learning projects.",
    skills: ["python"],
    department: "cse",
    location: "remote",
    synthetic: true,
  },
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let body;
    if (path === "/api/stats")
      body = { points: 85, counts: [{ value: "alumni", count: 50 }] };
    else if (path === "/api/facets")
      body = { department: ["cse"], skills: ["python"], location: ["remote"] };
    else if (path === "/api/search") body = { results: [record] };
    else if (path === "/api/records")
      body = { results: [record], nextOffset: null };
    else body = { record };
    await route.fulfill({ json: body });
  });
});

test("initializes statistics, filter options and category controls without errors", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#connection")).toHaveText("● Connected");
  await expect(page.locator("#skill option")).toHaveCount(2);
  await page.getByRole("button", { name: "Jobs", exact: true }).click();
  await expect(page.locator(".network-art")).toHaveAttribute(
    "data-category",
    "job",
  );
  await expect(page.locator("#query")).toHaveAttribute(
    "placeholder",
    /internship/,
  );
  expect(errors).toEqual([]);
});

async function search(page) {
  await page.goto("/");
  await expect(page.locator("#connection")).toHaveText("● Connected");
  await page.locator("#query").fill("Python mentoring");
  await page.locator("#query").press("Enter");
  await expect(page.locator(".result-card")).toHaveCount(1);
}

test("failed search removes stale results and restores controls", async ({
  page,
}) => {
  await search(page);
  await page.route("**/api/search", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Search temporarily unavailable" },
    }),
  );
  await page.locator("#search-button").click();
  await expect(page.locator("#error")).toHaveText(
    "Search temporarily unavailable",
  );
  await expect(page.locator(".result-card")).toHaveCount(0);
  await expect(page.locator("#score-note")).toBeHidden();
  await expect(page.locator("#search-button")).toBeEnabled();
  await expect(page.locator("#results")).toHaveAttribute("aria-busy", "false");
});

test("failed browse exits the loading state and supports retry", async ({
  page,
}) => {
  await page.route("**/api/records?*", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Browse temporarily unavailable" },
    }),
  );
  await page.goto("/");
  await page.locator("#browse-toggle").click();
  await expect(page.locator("#error")).toHaveText(
    "Browse temporarily unavailable",
  );
  await expect(page.locator("#result-info")).toHaveText(
    "Records could not load. Please try again.",
  );
  await page.unroute("**/api/records?*");
  await page.locator("#browse-toggle").click();
  await expect(page.locator(".result-card")).toHaveCount(1);
});

test("category and filter changes clear results and pagination from the previous selection", async ({
  page,
}) => {
  await search(page);
  await page.getByRole("button", { name: "Jobs", exact: true }).click();
  await expect(page.locator(".result-card")).toHaveCount(0);
  await page.locator("#search-button").click();
  await expect(page.locator(".result-card")).toHaveCount(1);
  await page.locator("#filter-toggle").click();
  await page.locator("#skill").selectOption("python");
  await expect(page.locator(".result-card")).toHaveCount(0);
  await expect(page.locator("#load-more")).toBeHidden();
});

test("search prevents category changes while a response is pending", async ({
  page,
}) => {
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/api/search", async (route) => {
    await pending;
    await route.fulfill({ json: { results: [record] } });
  });
  await page.goto("/");
  await page.locator("#query").fill("Python mentor");
  await page.locator("#search-button").click();
  try {
    await expect(
      page.getByRole("button", { name: "Jobs", exact: true }),
    ).toBeDisabled();
  } finally {
    release();
  }
  await expect(page.locator(".result-card")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Jobs", exact: true }),
  ).toBeEnabled();
});

test("empty results explain how to adjust the query", async ({ page }) => {
  await page.route("**/api/search", (route) =>
    route.fulfill({ json: { results: [] } }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Alumni in AI", exact: true }).click();
  await expect(page.locator("#results")).toContainText("No matches found");
  await expect(page.locator("#result-info")).toContainText("0 results");
  await expect(page.locator("#score-note")).toBeHidden();
});

test("browse pagination appends records and keeps a failed page available for retry", async ({
  page,
}) => {
  let failure = true;
  await page.route("**/api/records?*", async (route) => {
    const offset = new URL(route.request().url()).searchParams.get("offset");
    if (!offset)
      return route.fulfill({
        json: { results: [record], nextOffset: record.id },
      });
    if (failure)
      return route.fulfill({
        status: 503,
        json: { error: "Please retry this page" },
      });
    return route.fulfill({
      json: {
        results: [
          {
            ...record,
            id: "22222222-2222-4222-8222-222222222222",
            payload: { ...record.payload, title: "Second mentor" },
          },
        ],
        nextOffset: null,
      },
    });
  });
  await page.goto("/");
  await page.locator("#browse-toggle").click();
  await expect(page.locator(".result-card")).toHaveCount(1);
  await page.locator("#load-more").click();
  await expect(page.locator("#error")).toHaveText("Please retry this page");
  await expect(page.locator(".result-card")).toHaveCount(1);
  failure = false;
  await page.locator("#load-more").click();
  await expect(page.locator(".result-card")).toHaveCount(2);
  await expect(page.locator("#load-more")).toBeHidden();
});

test("details and related opportunity searches work", async ({ page }) => {
  await search(page);
  await page.locator(".card-action").click();
  await expect(page.locator(".detail-title")).toHaveText("Python mentor");
  const request = page.waitForRequest((r) => r.url().endsWith("/api/search"));
  await page
    .getByRole("button", { name: "Find related opportunities" })
    .click();
  expect((await request).postDataJSON()).toMatchObject({ kind: "job" });
  await expect(page.locator("#details")).not.toBeVisible();
  await expect(page.locator(".network-art")).toHaveAttribute(
    "data-category",
    "job",
  );
});

test("mobile search, details and animation controls remain accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await search(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator("#motion-toggle").click();
  await expect(page.locator("#motion-toggle")).toHaveText("Play animation");
  await page.locator(".card-action").click();
  await expect(page.locator("#details")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#details")).not.toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("#motion-toggle")).toBeHidden();
  expect(
    await page
      .locator(".satellite")
      .first()
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
});

test("sample records use plain labels without demo wording", async ({
  page,
}) => {
  await search(page);
  await expect(page.locator(".synthetic")).toHaveText("Sample");
  await expect(page.locator("footer")).not.toContainText("Demo");
});
