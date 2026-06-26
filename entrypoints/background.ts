export default defineBackground(() => {
  console.log('PageMind background', { id: browser.runtime.id });

  // Use Chrome native API for side panel
  // @ts-expect-error Chrome-specific API
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err: Error) => console.warn('sidePanel behavior error:', err));
});
