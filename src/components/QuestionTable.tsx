import type { QuestionTable as QuestionTableData } from '../types/quiz'

/** Rendu à partir de données structurées (pas de HTML brut dans le JSON du quiz) : un import non fiable ne
 * peut pas injecter de script, contrairement à du HTML libre — même logique que MermaidDiagram, qui passe
 * toujours par un rendu contrôlé plutôt que d'afficher un contenu tel quel. */
export function QuestionTable({ table }: { table: QuestionTableData }) {
  return <div className="question-table-wrap">
    <table className="question-table">
      {table.headers && <thead><tr>{table.headers.map((header, index) => <th key={index}>{header}</th>)}</tr></thead>}
      <tbody>
        {table.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}
      </tbody>
    </table>
  </div>
}
