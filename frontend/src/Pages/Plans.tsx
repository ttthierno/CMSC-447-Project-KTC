import { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { Document, Page, pdfjs } from "react-pdf";
import { apiFetch } from "../api";
import { anchorToDisplay, displayToAnchor } from "../anchors";
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();
type Drawing = { id: string; name: string; fileUrl: string; pageCount: number };
type Item = {
  id: string;
  title: string;
  drawingId: string;
  pageNumber: number;
  markerX: number;
  markerY: number;
  status: string;
};
type Project = { drawings: Drawing[]; punchItems: Item[]; currentRole: string };
export default function Plans() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useSearchParams();
  const input = useRef<HTMLInputElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [drawingId, setDrawingId] = useState<string | null>(null);
  const [role, setRole] = useState("");
  const [page, setPage] = useState(Number(query.get("page")) || 1);
  const [pages, setPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pageWidth, setPageWidth] = useState(620);
  const [rotation, setRotation] = useState(0);
  const [mode, setMode] = useState<"pan" | "pin">("pan");
  const [renderKey, setRenderKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await apiFetch(`/api/projects/${id}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!cancelled) {
          const p = data as Project;
          setDrawings(p.drawings);
          setItems(p.punchItems);
          setRole(p.currentRole);
          setDrawingId(
            p.drawings.find((d) => d.id === query.get("drawingId"))?.id ||
              p.drawings[0]?.id ||
              null,
          );
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Unable to load drawings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, query]);
  useEffect(() => {
    if (!viewport.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setPageWidth(Math.max(260, Math.min(850, entry.contentRect.width - 40))),
    );
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, [loading]);
  const currentRenderKey = `${drawingId}/${page}/${zoom}/${pageWidth}`;
  const rendered = renderKey === currentRenderKey;
  const selected = drawings.find((d) => d.id === drawingId);
  const pdfUrl = selected?.fileUrl;
  const pdfFile = useMemo(
    () => (pdfUrl ? { url: pdfUrl, withCredentials: true } : null),
    [pdfUrl],
  );
  const pins = items.filter(
    (i) => i.drawingId === drawingId && i.pageNumber === page,
  );
  const canCreate = ["ADMIN", "INSPECTOR"].includes(role);
  function selectPage(nextPage: number, nextDrawing = drawingId) {
    setPage(nextPage);
    if (nextDrawing) setQuery({ drawingId: nextDrawing, page: String(nextPage) }, { replace: true });
  }
  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (
      !file.name.toLowerCase().endsWith(".pdf") ||
      file.size > 25 * 1024 * 1024
    ) {
      setError("Choose a PDF no larger than 25 MB.");
      return;
    }
    setUploading(true);
    setError("");
    setMessage("");
    try {
      const data = new FormData();
      data.append("file", file);
      const response = await apiFetch(`/api/projects/${id}/drawings`, {
        method: "POST",
        body: data,
      });
      const saved = await response.json();
      if (!response.ok) throw new Error(saved.error);
      setDrawings((d) => [...d, saved]);
      setDrawingId(saved.id);
      selectPage(1, saved.id);
      setPages(0);
      setMessage("Drawing uploaded and all pages saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }
  function place(event: React.MouseEvent<HTMLDivElement>) {
    if (mode !== "pin" || !canCreate || !rendered || !selected) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const [x, y] = displayToAnchor(
      (event.clientX - rect.left) / rect.width,
      (event.clientY - rect.top) / rect.height,
      rotation,
    );
    const params = new URLSearchParams({
      drawingId: selected.id,
      pageNumber: String(page),
      markerX: Math.min(1, Math.max(0, x)).toFixed(8),
      markerY: Math.min(1, Math.max(0, y)).toFixed(8),
    });
    navigate(`/projects/${id}/punch-list/new?${params}`);
  }
  return (
    <div className="page sprint2-plans">
      <div className="page-header">
        <div>
          <h2>Plans</h2>
          <p>View drawings and create punch-list items at specific locations.</p>
        </div>
        {role === "ADMIN" && (
          <button
            className="primary-button"
            onClick={() => input.current?.click()}
            disabled={uploading}
          >
            {uploading ? "Uploading..." : "+ Upload Drawing"}
          </button>
        )}
        <input
          ref={input}
          type="file"
          accept=".pdf,application/pdf"
          onChange={upload}
          hidden
          aria-label="Upload PDF drawing"
        />
      </div>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <div className="plans-layout">
        <aside className="drawings-list">
          <h3>Drawings ({drawings.length})</h3>
          {loading ? (
            <p>Loading...</p>
          ) : !drawings.length ? (
            <p>No drawings yet. An administrator can upload a PDF.</p>
          ) : (
            drawings.map((d) => (
              <button
                key={d.id}
                className={`drawing-item ${d.id === drawingId ? "active" : ""}`}
                onClick={() => {
                  setDrawingId(d.id);
                  selectPage(1, d.id);
                  setPages(0);
                  setRenderKey("");
                }}
              >
                <strong>{d.name}</strong>
                <span>{d.pageCount} pages</span>
              </button>
            ))
          )}
        </aside>
        <section className="drawing-viewer" aria-label="Drawing viewer">
          <div className="drawing-header">
            <div>
              <strong>{selected?.name || "Drawing viewer"}</strong>
              <span>
                Page {page}
                {pages ? ` of ${pages}` : ""}
              </span>
            </div>
            <div className="drawing-tools">
              <button
                disabled={page <= 1}
                onClick={() => selectPage(page - 1)}
              >
                Previous
              </button>
              <button
                disabled={!pages || page >= pages}
                onClick={() => selectPage(page + 1)}
              >
                Next
              </button>
              <button
                aria-label="Zoom out"
                disabled={zoom <= 0.5}
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
              >
                −
              </button>
              <span aria-live="polite">{Math.round(zoom * 100)}%</span>
              <button
                aria-label="Zoom in"
                disabled={zoom >= 2.5}
                onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))}
              >
                +
              </button>
              <button onClick={() => setZoom(1)}>Fit</button>
              <button
                aria-pressed={mode === "pan"}
                onClick={() => setMode("pan")}
              >
                Pan
              </button>
              {canCreate && (
                <button
                  aria-pressed={mode === "pin"}
                  onClick={() => setMode("pin")}
                >
                  Place punch item
                </button>
              )}
              {selected && (
                <a className="drawing-punch-link" href={selected.fileUrl} target="_blank" rel="noreferrer">
                  Open PDF
                </a>
              )}
            </div>
          </div>
          <p className="viewer-hint">
            {mode === "pin"
              ? "Click the drawing to place a new punch item."
              : "Drag to pan, or select a saved marker to open its item."}
          </p>
          <div
            ref={viewport}
            className="drawing-canvas drawing-scroll"
            style={{ cursor: mode === "pan" ? "grab" : "crosshair" }}
            onPointerDown={(e) => {
              if (
                mode === "pan" &&
                !(e.target as HTMLElement).closest("button")
              ) {
                drag.current = {
                  x: e.clientX,
                  y: e.clientY,
                  left: e.currentTarget.scrollLeft,
                  top: e.currentTarget.scrollTop,
                };
                e.currentTarget.setPointerCapture(e.pointerId);
              }
            }}
            onPointerMove={(e) => {
              if (drag.current) {
                e.currentTarget.scrollLeft =
                  drag.current.left - (e.clientX - drag.current.x);
                e.currentTarget.scrollTop =
                  drag.current.top - (e.clientY - drag.current.y);
              }
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          >
            {pdfFile ? (
              <Document
                file={pdfFile}
                onLoadSuccess={({ numPages }) => {
                  setPages(numPages);
                  setPage((p) => Math.max(1, Math.min(numPages, p)));
                }}
                onLoadError={() =>
                  setError(
                    "Unable to display this PDF. Try reloading the project.",
                  )
                }
              >
                <div
                  data-testid="drawing-page"
                  onClick={place}
                  style={{
                    position: "relative",
                    display: "inline-block",
                    lineHeight: 0,
                  }}
                >
                  <Page
                    pageNumber={page}
                    width={pageWidth * zoom}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    onLoadSuccess={(p) => setRotation(p.rotate)}
                    onRenderSuccess={() => setRenderKey(currentRenderKey)}
                  />
                  {rendered &&
                    pins.map((pin, index) => {
                      const [x, y] = anchorToDisplay(
                        pin.markerX,
                        pin.markerY,
                        rotation,
                      );
                      return (
                        <button
                          key={pin.id}
                          data-testid="saved-marker"
                          data-item-id={pin.id}
                          aria-label={`Open punch item: ${pin.title}`}
                          title={pin.title}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/projects/${id}/punch-list/${pin.id}`);
                          }}
                          style={{
                            position: "absolute",
                            left: `${x * 100}%`,
                            top: `${y * 100}%`,
                            transform: "translate(-50%,-50%)",
                            width: 30,
                            height: 30,
                            borderRadius: "50%",
                            border: "2px solid white",
                            background:
                              pin.status === "COMPLETED"
                                ? "#16a34a"
                                : pin.status === "IN_PROGRESS" ? "#d97706" : "#dc2626",
                            color: "white",
                            fontWeight: 700,
                            lineHeight: "24px",
                            padding: 0,
                            cursor: "pointer",
                            zIndex: 2,
                          }}
                        >
                          {index + 1}
                        </button>
                      );
                    })}
                </div>
              </Document>
            ) : (
              <p>
                {loading ? "Loading drawings..." : "Select a drawing to begin."}
              </p>
            )}
          </div>
        </section>
      </div>
      <p>
        <Link to={`/projects/${id}`}>Back to project overview</Link>
      </p>
    </div>
  );
}
