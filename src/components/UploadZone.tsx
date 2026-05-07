import { Upload } from "lucide-react";
import { useRef } from "react";

interface UploadZoneProps {
  onFileSelected: (file: File) => void;
  isLoading: boolean;
}

export function UploadZone({ onFileSelected, isLoading }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    onFileSelected(file);
  };

  return (
    <div
      className="mx-auto mt-16 flex max-w-3xl cursor-pointer flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm"
      onClick={() => inputRef.current?.click()}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        handleFiles(event.dataTransfer.files);
      }}
    >
      <Upload className="mb-4 h-10 w-10 text-blue-600" />
      <h2 className="text-3xl font-semibold text-slate-900">Drop your Excel file here</h2>
      <p className="mt-3 text-slate-500">Upload one .xlsx file with BWA and Kanzlei-Profil sheets.</p>
      <button
        type="button"
        className="mt-8 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        disabled={isLoading}
      >
        {isLoading ? "Parsing..." : "Select Excel File"}
      </button>
      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept=".xlsx"
        onChange={(event) => handleFiles(event.target.files)}
      />
    </div>
  );
}

