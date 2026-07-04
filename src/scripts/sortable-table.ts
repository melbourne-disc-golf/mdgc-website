// Click a column header to sort a table's rows ascending.
//
// Opt in with class="sortable" on the <table> and data-sort="string" | "number"
// on each sortable <th>. A cell may set data-value to override its sort key
// (otherwise the cell's text is used). Sorting is ascending-only.

for (const table of document.querySelectorAll<HTMLTableElement>('table.sortable')) {
  const headers = table.querySelectorAll<HTMLTableCellElement>('th[data-sort]');
  const tbody = table.querySelector('tbody');
  if (!tbody) continue;

  headers.forEach((th, index) => {
    th.addEventListener('click', () => {
      headers.forEach((h) => h.classList.remove('sort-asc'));
      th.classList.add('sort-asc');

      const numeric = th.dataset.sort === 'number';
      const rows = Array.from(tbody.querySelectorAll('tr'));

      rows.sort((a, b) => {
        const aVal = a.cells[index].dataset.value ?? a.cells[index].textContent?.trim() ?? '';
        const bVal = b.cells[index].dataset.value ?? b.cells[index].textContent?.trim() ?? '';
        return numeric ? Number(aVal) - Number(bVal) : aVal.localeCompare(bVal);
      });

      for (const row of rows) tbody.appendChild(row);
    });
  });
}
