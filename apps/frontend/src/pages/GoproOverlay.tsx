import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Button } from '@dashboard-parapente/design-system';
import { api } from '../lib/api';
import { useToast } from '../hooks/useToast';
import {
  useCancelGoproOverlayJob,
  useCreateGoproOverlayJob,
  useGoproOverlayJobStream,
  useGoproOverlayLayouts,
} from '../hooks/gopro/useGoproOverlay';

type VideoResolution = {
  width: number;
  height: number;
};

const cardClass =
  'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900';
const labelClass =
  'mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200';
const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';

function detectVideoResolution(file: File): Promise<VideoResolution> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve({ width: video.videoWidth, height: video.videoHeight });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Unable to read video metadata'));
    };
    video.src = url;
  });
}

export default function GoproOverlayPage() {
  const toast = useToast();
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [gpxFile, setGpxFile] = useState<File | null>(null);
  const [pipFile, setPipFile] = useState<File | null>(null);
  const [resolution, setResolution] = useState<VideoResolution | null>(null);
  const [selectedLayoutId, setSelectedLayoutId] = useState('');
  const [outputFilename, setOutputFilename] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);

  const layoutsQuery = useGoproOverlayLayouts(
    resolution?.width,
    resolution?.height
  );
  const createJob = useCreateGoproOverlayJob();
  const cancelJob = useCancelGoproOverlayJob();
  const { job } = useGoproOverlayJobStream(jobId);
  const activeJob = job ?? createJob.data ?? null;
  const isRunning =
    activeJob?.status === 'queued' || activeJob?.status === 'running';

  useEffect(() => {
    const recommended = layoutsQuery.data?.find((layout) => layout.recommended);
    if (recommended && !selectedLayoutId) {
      setSelectedLayoutId(recommended.id);
    }
  }, [layoutsQuery.data, selectedLayoutId]);

  async function handleVideoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setVideoFile(file);
    setResolution(null);
    setSelectedLayoutId('');
    if (!file) {
      return;
    }

    try {
      setResolution(await detectVideoResolution(file));
      const basename = file.name.replace(/\.[^.]+$/, '');
      setOutputFilename(`${basename}-overlay.mp4`);
    } catch {
      toast.error('Impossible de lire la résolution de la vidéo');
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!videoFile || !gpxFile || !selectedLayoutId) {
      toast.error('Vidéo, GPX et layout sont obligatoires');
      return;
    }

    const formData = new FormData();
    formData.append('video_file', videoFile);
    formData.append('gpx_file', gpxFile);
    formData.append('layout_id', selectedLayoutId);
    if (pipFile) {
      formData.append('pip_file', pipFile);
    }
    if (outputFilename.trim()) {
      formData.append('output_filename', outputFilename.trim());
    }

    try {
      const created = await createJob.mutateAsync(formData);
      setJobId(created.job_id);
      toast.success('Génération GoPro lancée');
    } catch {
      toast.error('Impossible de lancer la génération GoPro');
    }
  }

  async function handleDownload() {
    if (!activeJob || activeJob.status !== 'completed') {
      return;
    }

    try {
      const blob = await api
        .get(`gopro-overlays/jobs/${activeJob.job_id}/download`, {
          timeout: false,
        })
        .blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = activeJob.output_filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Téléchargement impossible');
    }
  }

  async function handleCancel() {
    if (!activeJob) {
      return;
    }
    try {
      await cancelJob.mutateAsync(activeJob.job_id);
      toast.success('Génération annulée');
    } catch {
      toast.error("Impossible d'annuler la génération");
    }
  }

  return (
    <div className="space-y-5 py-4">
      <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-sky-950 to-cyan-800 p-6 text-white shadow-xl">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">
          GoPro Data Overlay
        </p>
        <h1 className="text-3xl font-bold">Overlay parapente</h1>
        <p className="mt-3 max-w-3xl text-sm text-cyan-50/90">
          Choisis la vidéo principale, le GPX, un layout adapté à la résolution
          et une vidéo PIP optionnelle. La sortie est générée côté serveur puis
          téléchargeable ici.
        </p>
      </section>

      <form className={`${cardClass} space-y-5`} onSubmit={handleSubmit}>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="gopro-main-video">
              Vidéo principale
            </label>
            <input
              id="gopro-main-video"
              className={inputClass}
              type="file"
              accept="video/mp4,video/quicktime,.mp4,.mov,.m4v"
              onChange={handleVideoChange}
            />
            {resolution && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Résolution détectée : {resolution.width}x{resolution.height}
              </p>
            )}
          </div>

          <div>
            <label className={labelClass} htmlFor="gopro-gpx">
              Fichier GPX/FIT
            </label>
            <input
              id="gopro-gpx"
              className={inputClass}
              type="file"
              accept=".gpx,.fit"
              onChange={(event) => setGpxFile(event.target.files?.[0] ?? null)}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="gopro-layout">
              Layout parapente
            </label>
            <select
              id="gopro-layout"
              className={inputClass}
              value={selectedLayoutId}
              onChange={(event) => setSelectedLayoutId(event.target.value)}
            >
              <option value="">Choisir un layout</option>
              {layoutsQuery.data?.map((layout) => (
                <option
                  key={layout.id}
                  value={layout.id}
                  disabled={!layout.exists}
                >
                  {layout.label}
                  {layout.recommended ? ' - recommandé' : ''}
                  {layout.exists ? '' : ' - fichier absent'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="gopro-pip-video">
              Vidéo PIP optionnelle
            </label>
            <input
              id="gopro-pip-video"
              className={inputClass}
              type="file"
              accept="video/mp4,video/quicktime,.mp4,.mov,.m4v"
              onChange={(event) => setPipFile(event.target.files?.[0] ?? null)}
            />
          </div>

          <div className="lg:col-span-2">
            <label className={labelClass} htmlFor="gopro-output">
              Nom du fichier de sortie
            </label>
            <input
              id="gopro-output"
              className={inputClass}
              type="text"
              value={outputFilename}
              placeholder="vol-arguel-overlay.mp4"
              onChange={(event) => setOutputFilename(event.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            type="submit"
            isDisabled={createJob.isPending || isRunning}
            className="rounded-lg bg-sky-600 px-5 py-2 text-white hover:bg-sky-700 disabled:bg-slate-400"
          >
            {createJob.isPending || isRunning
              ? 'Génération en cours'
              : 'Lancer'}
          </Button>
          {isRunning && (
            <Button
              type="button"
              onClick={handleCancel}
              isDisabled={cancelJob.isPending}
              className="rounded-lg bg-red-600 px-5 py-2 text-white hover:bg-red-700 disabled:bg-slate-400"
            >
              Annuler
            </Button>
          )}
          {activeJob?.status === 'completed' && (
            <Button
              type="button"
              onClick={handleDownload}
              className="rounded-lg bg-emerald-600 px-5 py-2 text-white hover:bg-emerald-700"
            >
              Télécharger
            </Button>
          )}
        </div>
      </form>

      {activeJob && (
        <section className={cardClass}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Job {activeJob.job_id.slice(0, 8)}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {activeJob.layout_label} · {activeJob.output_filename}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {activeJob.status}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-sky-500 transition-all duration-500"
              style={{
                width: `${Math.max(0, Math.min(activeJob.progress, 100))}%`,
              }}
            />
          </div>
          <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">
            {activeJob.message}
          </p>
          {activeJob.error && (
            <pre className="mt-3 max-h-56 overflow-auto rounded-lg bg-red-950 p-3 text-xs text-red-50">
              {activeJob.error}
            </pre>
          )}
        </section>
      )}
    </div>
  );
}
