import { MockDocument } from "../types";

export function TemplateDock({
  composerBody,
  composerTitle,
  isSubmitting,
  onBodyChange,
  onRun,
  onSelectTemplate,
  onTitleChange,
  selectedTemplateId,
  templates,
}: {
  composerBody: string;
  composerTitle: string;
  isSubmitting: boolean;
  onBodyChange: (value: string) => void;
  onRun: () => void;
  onSelectTemplate: (template: MockDocument) => void;
  onTitleChange: (value: string) => void;
  selectedTemplateId: string | null;
  templates: MockDocument[];
}) {
  return (
    <>
      <nav className="template-grid template-nav" aria-label="Mock procurement templates">
        {templates.map((template) => (
          <button
            className={`template-card ${selectedTemplateId === template.id ? "template-card--active" : ""}`}
            key={template.id}
            onClick={() => onSelectTemplate(template)}
            type="button"
          >
            <span className="template-card__category">{template.category}</span>
            <strong>{template.title}</strong>
            <p>{template.summary}</p>
          </button>
        ))}
      </nav>

      <section className="composer-grid" aria-label="Case composer">
        <label className="field">
          <span>Case Title</span>
          <input
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="Paste or rename the procurement case"
            value={composerTitle}
          />
        </label>

        <label className="field field-textarea">
          <span>Submission</span>
          <textarea
            onChange={(event) => onBodyChange(event.target.value)}
            placeholder="Paste procurement notes, contract language, or an RFP response"
            value={composerBody}
          />
        </label>

        <footer className="composer-actions">
          <button disabled={isSubmitting || !composerBody.trim()} onClick={onRun} type="button">
            {isSubmitting ? "Launching..." : "Run Analysis"}
          </button>
          <span>Cases start with mocked agent outputs and a real LangGraph pause/resume cycle.</span>
        </footer>
      </section>
    </>
  );
}
