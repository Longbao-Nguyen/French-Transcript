import { useRef, useState } from 'react';
import { CloudUpload, Files } from 'lucide-react';

export function MultiFileUploadPanel({ onFiles }: { onFiles: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const acceptFiles = (list: FileList | null) => {
    if (!list?.length) return;
    onFiles(Array.from(list));
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Files className="h-5 w-5 text-blue-600" />
        <h2 className="font-bold text-slate-900">Upload files</h2>
      </div>
      <div
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={(event) => { event.preventDefault(); setDragging(false); }}
        onDrop={(event) => { event.preventDefault(); setDragging(false); acceptFiles(event.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`min-h-44 rounded-xl border-2 border-dashed grid place-items-center px-4 text-center cursor-pointer transition-colors ${dragging ? 'border-blue-500 bg-blue-50' : 'border-blue-200 bg-blue-50/30 hover:bg-blue-50/60'}`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => acceptFiles(event.target.files)}
        />
        <div>
          <CloudUpload className="mx-auto h-9 w-9 text-blue-500" />
          <p className="mt-3 font-semibold text-slate-800">Drop audio or video files here</p>
          <p className="mt-1 text-xs text-slate-500">or click to browse — multiple files are supported</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Files upload directly to private object storage. Browser codec support is not used for validation.
      </p>
    </section>
  );
}
