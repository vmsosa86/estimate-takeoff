"use client";

import { useId, useState } from "react";

type UploadFormProps = {
  action: string;
};

type UploadState = {
  error?: string;
  isUploading: boolean;
  progress: number;
};

const initialState: UploadState = {
  isUploading: false,
  progress: 0,
};

export function UploadForm({ action }: UploadFormProps) {
  const inputId = useId();
  const [state, setState] = useState<UploadState>(initialState);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      setState({
        error: "Choose a PDF file to upload.",
        isUploading: false,
        progress: 0,
      });
      return;
    }

    const xhr = new XMLHttpRequest();

    setState({
      isUploading: true,
      progress: 0,
    });

    xhr.open("POST", action);
    xhr.setRequestHeader("x-requested-with", "XMLHttpRequest");

    xhr.upload.addEventListener("progress", (progressEvent) => {
      if (!progressEvent.lengthComputable) {
        return;
      }

      const progress = Math.min(
        100,
        Math.round((progressEvent.loaded / progressEvent.total) * 100),
      );

      setState((current) => ({
        ...current,
        progress,
      }));
    });

    xhr.addEventListener("load", () => {
      let redirectTo = "";
      let errorMessage = "The PDF could not be processed.";

      try {
        const response = JSON.parse(xhr.responseText) as {
          error?: string;
          redirectTo?: string;
        };

        redirectTo = response.redirectTo ?? "";
        errorMessage = response.error ?? errorMessage;
      } catch {
        errorMessage = "The server returned an unexpected upload response.";
      }

      if (xhr.status >= 200 && xhr.status < 300 && redirectTo) {
        window.location.assign(redirectTo);
        return;
      }

      setState({
        error: errorMessage,
        isUploading: false,
        progress: 0,
      });
    });

    xhr.addEventListener("error", () => {
      setState({
        error: "Upload failed. Check your connection and try again.",
        isUploading: false,
        progress: 0,
      });
    });

    xhr.send(formData);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <p className="text-sm font-medium text-[var(--color-muted)]">
          Upload PDF drawings
        </p>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          PDF files only. Uploaded plans are stored on local disk.
        </p>
      </div>

      <label className="block space-y-2" htmlFor={inputId}>
        <input
          required
          id={inputId}
          name="file"
          type="file"
          accept="application/pdf,.pdf"
          disabled={state.isUploading}
          className="block w-full rounded-2xl border border-dashed border-[var(--color-border)] bg-white px-4 py-4 text-sm text-[var(--color-muted)] file:mr-4 file:rounded-full file:border-0 file:bg-[var(--color-accent)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white disabled:cursor-not-allowed disabled:opacity-70"
        />
      </label>

      {state.isUploading ? (
        <div className="space-y-2">
          <div className="h-3 overflow-hidden rounded-full bg-[rgba(155,93,51,0.12)]">
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-200"
              style={{ width: `${state.progress}%` }}
            />
          </div>
          <p className="text-sm text-[var(--color-muted)]">
            Uploading PDF... {state.progress}%
          </p>
        </div>
      ) : null}

      {state.error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={state.isUploading}
        className="inline-flex rounded-full border border-[var(--color-border)] bg-white px-5 py-3 text-sm font-semibold transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {state.isUploading ? "Uploading..." : "Upload PDF"}
      </button>
    </form>
  );
}
