
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

type Drawing = {
  id: number;
  name: string;
  fileUrl: string | null;
  projectId: number;
};

type PunchItemData = {
  id: number;
  title: string;
  status: string;
  drawingId: number | null;
  markerX: number | null;
  markerY: number | null;
  pageNumber: number | null;
};

type ProjectData = {
  id: number;
  name: string;
  drawings: Drawing[];
  punchItems: PunchItemData[];
};

function Plans() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [punchItems, setPunchItems] = useState<PunchItemData[]>([]);
  const [selectedDrawingId, setSelectedDrawingId] = useState<number | null>(
    null
  );
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProject() {
      if (!id) {
        setError("Select a project to view its drawings.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `http://localhost:3000/api/projects/${id}`
        );
        const data: ProjectData = await response.json();

        if (!response.ok) {
          throw new Error("Could not load project drawings.");
        }

        if (!cancelled) {
          setDrawings(data.drawings ?? []);
          setPunchItems(data.punchItems ?? []);
          setSelectedDrawingId(data.drawings?.[0]?.id ?? null);
        }
      } catch (error) {
        if (!cancelled) {
          setError(
            error instanceof Error
              ? error.message
              : "Could not connect to the backend."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProject();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    setPageNumber(1);
    setNumPages(0);
  }, [selectedDrawingId]);

  const selectedDrawing =
    drawings.find((drawing) => drawing.id === selectedDrawingId) ?? null;

  const visiblePins = punchItems.filter(
    (item) =>
      item.drawingId === selectedDrawingId &&
      item.pageNumber === pageNumber &&
      item.markerX !== null &&
      item.markerY !== null
  );

  async function handleFileSelected(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !id) return;

    if (
      file.type !== "application/pdf" ||
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("Please select a PDF file.");
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setError("The PDF must be smaller than 25 MB.");
      return;
    }

    setUploading(true);
    setError("");
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", file.name.replace(/\.pdf$/i, ""));

      const response = await fetch(
        `http://localhost:3000/api/projects/${id}/drawings`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not upload drawing.");
      }

      const drawing: Drawing = data;

      setDrawings((current) => [...current, drawing]);
      setSelectedDrawingId(drawing.id);
      setMessage("Drawing uploaded successfully.");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not upload drawing."
      );
    } finally {
      setUploading(false);
    }
  }

  function handleDrawingClick(
    event: React.MouseEvent<HTMLDivElement>
  ) {
    console.log("Drawing clicked!");
    if (!id || !selectedDrawing) return;

    const rectangle = event.currentTarget.getBoundingClientRect();

    if (!rectangle.width || !rectangle.height) return;

    const markerX = Math.min(
      1,
      Math.max(0, (event.clientX - rectangle.left) / rectangle.width)
    );

    const markerY = Math.min(
      1,
      Math.max(0, (event.clientY - rectangle.top) / rectangle.height)
    );

    const query = new URLSearchParams({
      drawingId: String(selectedDrawing.id),
      pageNumber: String(pageNumber),
      markerX: markerX.toFixed(6),
      markerY: markerY.toFixed(6),
    });

    navigate(`/projects/${id}/punch-list/new?${query.toString()}`);
  }

  function onDocumentLoadSuccess(result: { numPages: number }) {
    setNumPages(result.numPages);
    setPageNumber(1);
  }

  const pdfUrl = selectedDrawing?.fileUrl
    ? `http://localhost:3000${selectedDrawing.fileUrl}`
    : null;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Plans</h2>
          <p>View drawings and create punch-list items at specific locations.</p>
        </div>

        <button
          type="button"
          className="primary-button"
          disabled={uploading || !id}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? "Uploading..." : "+ Upload Drawing"}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          hidden
          onChange={handleFileSelected}
        />
      </div>

      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}

      <div className="plans-layout">
        <div className="drawings-list">
          <h3>Drawings ({drawings.length})</h3>

          {loading ? (
            <p>Loading drawings...</p>
          ) : drawings.length === 0 ? (
            <p>No drawings yet. Upload a PDF to get started.</p>
          ) : (
            drawings.map((drawing) => (
              <button
                type="button"
                key={drawing.id}
                className={`drawing-item ${
                  drawing.id === selectedDrawingId ? "active" : ""
                }`}
                onClick={() => setSelectedDrawingId(drawing.id)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <strong>{drawing.name}</strong>
                <span>PDF drawing</span>
              </button>
            ))
          )}
        </div>

        <div className="drawing-viewer">
          <div className="drawing-header">
            <div>
              <strong>{selectedDrawing?.name ?? "Drawing Viewer"}</strong>
              <span>
                {selectedDrawing
                  ? `Page ${pageNumber}${numPages ? ` of ${numPages}` : ""}`
                  : "Select or upload a drawing"}
              </span>
            </div>

            <div className="drawing-tools">
              <button
                type="button"
                disabled={pageNumber <= 1}
                onClick={() => setPageNumber((page) => page - 1)}
              >
                Previous
              </button>

              <button
                type="button"
                disabled={!numPages || pageNumber >= numPages}
                onClick={() => setPageNumber((page) => page + 1)}
              >
                Next
              </button>

              {pdfUrl && (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="drawing-punch-link"
                >
                  Open PDF
                </a>
              )}
            </div>
          </div>

          <div className="drawing-canvas">
            {loading ? (
              <p>Loading drawings...</p>
            ) : pdfUrl ? (
              <Document
                file={pdfUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={() =>
                  setError("Could not display the PDF. Try opening it directly.")
                }
                loading={<p>Loading PDF...</p>}
              >
                <div
                  onClick={handleDrawingClick}
                  style={{
                    position: "relative",
                    display: "inline-block",
                    cursor: "crosshair",
                    lineHeight: 0,
                    maxWidth: "100%",
                  }}
                  title="Click a location to create a punch item"
                >
                  <Page
                    pageNumber={pageNumber}
                    width={Math.min(800, Math.max(320, window.innerWidth * 0.55))}
                  />

                  {visiblePins.map((pin) => (
                    <button
                      type="button"
                      key={pin.id}
                      title={pin.title}
                      aria-label={`Open punch item ${pin.id}: ${pin.title}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(
                          `/projects/${id}/punch-list/${pin.id}`
                        );
                      }}
                      style={{
                        position: "absolute",
                        left: `${pin.markerX! * 100}%`,
                        top: `${pin.markerY! * 100}%`,
                        transform: "translate(-50%, -50%)",
                        width: 30,
                        height: 30,
                        borderRadius: "50%",
                        border: "2px solid white",
                        background:
                          pin.status === "COMPLETED"
                            ? "#16a34a"
                            : pin.status === "IN_PROGRESS"
                              ? "#d97706"
                              : "#dc2626",
                        color: "white",
                        fontWeight: 700,
                        cursor: "pointer",
                        lineHeight: "26px",
                        zIndex: 2,
                      }}
                    >
                      {pin.id}
                    </button>
                  ))}
                </div>
              </Document>
            ) : (
              <div className="photo-placeholder">
                Upload a PDF to view it here. Then click on the drawing to
                create a punch item at that location.
              </div>
            )}
          </div>
        </div>
      </div>

      <p>
        <Link to={`/projects/${id}`}>← Back to Project Overview</Link>
      </p>
    </div>
  );
}

export default Plans;
