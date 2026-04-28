/**
 * DataTable Component
 * Generates a dynamic HTML table from data array and columns configuration.
 * 
 * @param {Array} data - Array of objects containing row data.
 * @param {Array} columns - Array of objects defining columns: { key, label, render(item) }
 */
function renderDataTable(data, columns) {
    if (!data || data.length === 0) {
        return `
        <div style="overflow-x: auto;">
            <table>
                <thead>
                    <tr>${columns.map(col => `<th>${col.label}</th>`).join('')}</tr>
                </thead>
                <tbody>
                    <tr><td colspan="${columns.length}" style="text-align:center;color:var(--text-muted);padding:30px;">لا توجد بيانات لعرضها</td></tr>
                </tbody>
            </table>
        </div>`;
    }

    const headers = columns.map(col => `<th>${col.label}</th>`).join('');
    
    const rows = data.map(item => {
        const cells = columns.map(col => {
            if (col.render) {
                return `<td>${col.render(item)}</td>`;
            }
            return `<td>${item[col.key] || '-'}</td>`;
        }).join('');
        return `<tr>${cells}</tr>`;
    }).join('');

    return `
        <div style="overflow-x: auto;">
            <table>
                <thead>
                    <tr>${headers}</tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `;
}
