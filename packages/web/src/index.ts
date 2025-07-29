const modal = document.getElementById("modal") as HTMLDialogElement;
const modalClose = document.getElementById("close")!;
const help = document.getElementById("help")!;
const search = document.getElementById("search")! as HTMLInputElement;
const tableTbody = document.getElementById("table-tbody")!;

/////////////////////////
// URL State Management
/////////////////////////
function getQueryParams() {
  return new URLSearchParams(window.location.search);
}

function updateQueryParams(updates: Record<string, string | null>) {
  const params = getQueryParams();
  for (const [key, value] of Object.entries(updates)) {
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
  }
  const newPath = params.toString()
    ? `${window.location.pathname}?${params.toString()}`
    : window.location.pathname;
  window.history.pushState({}, "", newPath);
}

function getColumnNameForURL(headerEl: Element): string {
  const text = headerEl.textContent?.trim().toLowerCase() || "";
  return text.replace(/↑|↓/g, "").trim().split(/\s+/).slice(0, 2).join("-");
}

function getColumnIndexByUrlName(name: string): number {
  const headers = document.querySelectorAll("th.sortable");
  return Array.from(headers).findIndex(
    (header) => getColumnNameForURL(header) === name
  );
}

/////////////////////////
// Handle "How to use"
/////////////////////////
let y = 0;

help.addEventListener("click", () => {
  scrollY = window.scrollY;
  document.body.style.position = "fixed";
  document.body.style.top = `-${y}px`;
  modal.showModal();
});

function closeDialog() {
  modal.close();
  document.body.style.position = "";
  document.body.style.top = "";
  window.scrollTo(0, scrollY);
}

modalClose.addEventListener("click", closeDialog);
modal.addEventListener("cancel", closeDialog);
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeDialog();
});

////////////////////
// Handle Sorting
////////////////////
let currentSort = { column: -1, direction: "asc" };
let pinnedModels = new Set<string>();

function sortTable(column: number, direction: "asc" | "desc") {
  const header = document.querySelectorAll("th.sortable")[column];
  const columnType = header.getAttribute("data-type");
  if (!columnType) return;

  // update state
  currentSort = { column, direction };
  updateQueryParams({
    sort: getColumnNameForURL(header),
    order: direction,
  });

  // sort rows (excluding pinned rows from sorting)
  const tbody = document.querySelector("table tbody")!;
  const rows = Array.from(
    tbody.querySelectorAll("tr:not(.pinned-row)")
  ) as HTMLTableRowElement[];
  rows.sort((a, b) => {
    const aValue = getCellValue(a.cells[column], columnType);
    const bValue = getCellValue(b.cells[column], columnType);

    // Handle undefined values - always sort to bottom
    if (aValue === undefined && bValue === undefined) return 0;
    if (aValue === undefined) return 1;
    if (bValue === undefined) return -1;

    let comparison = 0;
    if (columnType === "number" || columnType === "modalities") {
      comparison = (aValue as number) - (bValue as number);
    } else if (columnType === "boolean") {
      comparison = (aValue as string).localeCompare(bValue as string);
    } else {
      comparison = (aValue as string).localeCompare(bValue as string);
    }

    return direction === "asc" ? comparison : -comparison;
  });
  // Insert sorted rows after pinned rows
  const pinnedRows = tbody.querySelectorAll(".pinned-row");
  const lastPinnedRow = pinnedRows[pinnedRows.length - 1];
  
  if (lastPinnedRow) {
    let currentRow = lastPinnedRow;
    rows.forEach((row) => {
      currentRow.insertAdjacentElement('afterend', row);
      currentRow = row;
    });
  } else {
    rows.forEach((row) => tbody.appendChild(row));
  }

  // update sort indicators
  const headers = document.querySelectorAll("th.sortable");
  headers.forEach((header, i) => {
    const indicator = header.querySelector(".sort-indicator")!;

    if (i === column) {
      indicator.textContent = direction === "asc" ? "↑" : "↓";
    } else {
      indicator.textContent = "";
    }
  });
}

function getCellValue(
  cell: HTMLTableCellElement,
  type: string
): string | number | undefined {
  if (type === "modalities")
    return cell.querySelectorAll(".modality-icon").length;

  const text = cell.textContent?.trim() || "";
  if (text === "-") return;
  if (type === "number") return parseFloat(text.replace(/[$,]/g, "")) || 0;
  return text;
}

document.querySelectorAll("th.sortable").forEach((header) => {
  header.addEventListener("click", () => {
    const column = Array.from(header.parentElement!.children).indexOf(header);
    const direction =
      currentSort.column === column && currentSort.direction === "asc"
        ? "desc"
        : "asc";
    sortTable(column, direction);
  });
});

///////////////////
// Handle Search
///////////////////
function filterTable(value: string) {
  const lowerCaseValue = value.toLowerCase();
  const rows = document.querySelectorAll(
    "table tbody tr:not(.pinned-row)"
  ) as NodeListOf<HTMLTableRowElement>;

  rows.forEach((row) => {
    const cellTexts = Array.from(row.cells).map((cell) =>
      cell.textContent!.toLowerCase()
    );
    const isVisible = cellTexts.some((text) => text.includes(lowerCaseValue));
    row.style.display = isVisible ? "" : "none";
  });

  updateQueryParams({ search: value || null });
}

search.addEventListener("input", () => {
  filterTable(search.value);
});

document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "k") {
    e.preventDefault();
    search.focus();
  }
});

search.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    search.value = "";
    search.dispatchEvent(new Event("input"));
  }
});

///////////////////////////////////
// Handle Copy model ID function
///////////////////////////////////
(window as any).copyModelId = async (
  button: HTMLButtonElement,
  modelId: string
) => {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(modelId);

      // Switch to check icon
      const copyIcon = button.querySelector(".copy-icon") as HTMLElement;
      const checkIcon = button.querySelector(".check-icon") as HTMLElement;

      copyIcon.style.display = "none";
      checkIcon.style.display = "block";

      // Switch back after 1 second
      setTimeout(() => {
        copyIcon.style.display = "block";
        checkIcon.style.display = "none";
      }, 1000);
    }
  } catch (err) {
    console.error("Failed to copy text: ", err);
  }
};

///////////////////////////////////
// Initialize State from URL
///////////////////////////////////
function initializeFromURL() {
  const params = getQueryParams();

  (() => {
    const searchQuery = params.get("search");
    if (!searchQuery) return;
    search.value = searchQuery;
    filterTable(searchQuery);
  })();

  (() => {
    const columnName = params.get("sort");
    if (!columnName) return;

    const columnIndex = getColumnIndexByUrlName(columnName);
    if (columnIndex === -1) return;

    const direction = (params.get("order") as "asc" | "desc") || "asc";
    sortTable(columnIndex, direction);
  })();
}

document.addEventListener("DOMContentLoaded", initializeFromURL);
window.addEventListener("popstate", initializeFromURL);

///////////////////////////////////
// Handle Pin functionality
///////////////////////////////////
(window as any).togglePin = (providerId: string, modelId: string, checkbox: HTMLInputElement) => {
  const modelKey = `${providerId}-${modelId}`;
  
  if (checkbox.checked) {
    pinnedModels.add(modelKey);
    addPinnedRow(providerId, modelId);
  } else {
    pinnedModels.delete(modelKey);
    removePinnedRow(modelKey);
  }
  
  updatePinnedContainerVisibility();
};

function addPinnedRow(providerId: string, modelId: string) {
  const originalRow = document.querySelector(`tr[data-provider-id="${providerId}"][data-model-id="${modelId}"]`) as HTMLTableRowElement;
  if (!originalRow) return;
  
  const clonedRow = originalRow.cloneNode(true) as HTMLTableRowElement;
  clonedRow.classList.add('pinned-row');
  clonedRow.setAttribute('data-pinned-key', `${providerId}-${modelId}`);
  
  // Update the checkbox in the pinned row to be checked and handle unpinning
  const checkbox = clonedRow.querySelector('.pin-checkbox') as HTMLInputElement;
  checkbox.checked = true;
  checkbox.setAttribute('onchange', `togglePin('${providerId}', '${modelId}', this)`);
  
  // Insert the pinned row at the beginning of tbody
  tableTbody.insertBefore(clonedRow, tableTbody.firstChild);
}

function removePinnedRow(modelKey: string) {
  const pinnedRow = tableTbody.querySelector(`tr[data-pinned-key="${modelKey}"]`);
  if (pinnedRow) {
    pinnedRow.remove();
  }
  
  // Also uncheck the original row's checkbox
  const [providerId, modelId] = modelKey.split('-');
  const originalCheckbox = document.querySelector(`tr[data-provider-id="${providerId}"][data-model-id="${modelId}"]:not(.pinned-row) .pin-checkbox`) as HTMLInputElement;
  if (originalCheckbox) {
    originalCheckbox.checked = false;
  }
}

function updatePinnedContainerVisibility() {
  // No longer needed since we're using a single table
}
