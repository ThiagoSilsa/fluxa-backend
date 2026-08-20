/**
 * Dados do job enfileirado na fila `import-departments` (ADR 0007 §2).
 */
export interface ImportDepartmentsJobData {
  /** Id do job criado na tabela `import_job`. */
  jobId: string;
  /** Empresa da sessão (multi-tenant). */
  companyId: string;
  /** Id do usuário que fez o upload. */
  createdByUserId: string;
  /** Caminho do arquivo XLSX salvo em disco (o worker relê do disco). */
  filePath: string;
  /** Total de linhas da planilha. */
  totalRows: number;
}
