'use client';

import { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { useAuthStore } from '@/hooks/useAuthStore';
import { 
  ArrowLeft, ArrowRight, Upload, Mic, FileAudio, Brain, Download, 
  Check, Loader2, Play, Pause, Square, RefreshCw, FileText, 
  Calendar, Users, AlertTriangle, ListTodo, Mail, Map, CheckCircle2,
  Trash2, Eye, Share2, Edit2, Save, X, Plus
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import Mermaid from './Mermaid';

type Step = 1 | 2 | 3 | 4;

interface TranscriptSegment {
  id: string;
  start: number;
  end: number;
  content: string;
  speakerId?: string;
  speaker?: { id: string; name: string; role?: string };
}

interface Analysis {
  id: string;
  summary?: string;
  keyPoints?: string[];
  decisions?: string[];
  risks?: string[];
  openQuestions?: string[];
  tasks?: Task[];
  dates?: DateItem[];
  mindmap?: string;
}

interface Task {
  id: string;
  description: string;
  owner?: string;
  priority: string;
  status: string;
  dueDate?: string;
}

interface DateItem {
  id: string;
  date: string;
  description?: string;
}

export default function StepperWizard() {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [method, setMethod] = useState<'upload' | 'record' | null>(null);
  const [job, setJob] = useState<any>(null);
  const [transcript, setTranscript] = useState<any>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editingSpeakers, setEditingSpeakers] = useState(false);
  const [editingTranscript, setEditingTranscript] = useState(false);
  const [editedSegments, setEditedSegments] = useState<TranscriptSegment[]>([]);
  const [emailDraft, setEmailDraft] = useState<string | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [markdownContent, setMarkdownContent] = useState<string | null>(null);
  const [showMarkdownModal, setShowMarkdownModal] = useState(false);
  const { token, currentJobId, setCurrentJob, setView } = useAuthStore();

  useEffect(() => {
    if (currentJobId) {
      loadExistingJob(currentJobId);
    }
  }, [currentJobId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      
      const file = acceptedFiles[0];
      setLoading(true);
      setUploadProgress(0);

      const formData = new FormData();
      formData.append('file', file);

      try {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        };

        const result = await new Promise<any>((resolve, reject) => {
          xhr.onload = () => {
            if (xhr.status === 200) {
              resolve(JSON.parse(xhr.responseText));
            } else {
              reject(new Error('Upload failed'));
            }
          };
          xhr.onerror = () => reject(new Error('Upload failed'));
          xhr.open('POST', '/api/upload');
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          xhr.send(formData);
        });

        setJob(result.job);
        setCurrentJob(result.job.id);
        setMethod('upload');
        setCurrentStep(2);
        pollJobStatus(result.job.id);
      } catch (error) {
        console.error('Upload error:', error);
      } finally {
        setLoading(false);
      }
    },
    accept: {
      'audio/*': ['.mp3', '.wav', '.m4a', '.ogg', '.webm'],
      'video/*': ['.mp4', '.webm']
    },
    maxFiles: 1,
  });

  const steps = [
    { number: 1, title: 'Método', description: 'Elegir método' },
    { number: 2, title: 'Transcripción', description: 'Procesando' },
    { number: 3, title: 'Análisis', description: 'IA análisis' },
    { number: 4, title: 'Exportar', description: 'Descargar' },
  ];

  const loadExistingJob = async (jobId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const jobData = await res.json();
        setJob(jobData);
        
        if (jobData.status === 'COMPLETED') {
          await fetchTranscript(jobId);
          await fetchAnalysis(jobId);
          setCurrentStep(4);
        } else if (jobData.status === 'PROCESSING') {
          setCurrentStep(2);
          pollJobStatus(jobId);
        }
      }
    } catch (error) {
      console.error('Error loading job:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalysis = async (jobId: string) => {
    try {
      const res = await fetch(`/api/analysis/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAnalysis(data);
      }
    } catch (error) {
      console.error('Error fetching analysis:', error);
    }
  };

  const handleDeleteJob = async () => {
    if (!job || !confirm('¿Estás seguro de eliminar este archivo?')) return;
    
    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        setCurrentJob(null);
        setJob(null);
        setView('dashboard');
      }
    } catch (error) {
      console.error('Error deleting job:', error);
    }
  };

  const goBack = () => {
    if (currentStep === 1) {
      setView('dashboard');
    } else {
      setCurrentStep((prev) => (prev - 1) as Step);
    }
  };

  const fetchTranscript = async (jobId: string) => {
    try {
      const res = await fetch(`/api/transcript/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTranscript(data);
      }
    } catch (error) {
      console.error('Error fetching transcript:', error);
    }
  };

  const updateSpeakerName = (speakerId: string, name: string) => {
    if (transcript && transcript.speakers) {
      setTranscript({
        ...transcript,
        speakers: transcript.speakers.map((s: any) =>
          s.id === speakerId ? { ...s, name } : s
        )
      });
    }
  };

  const updateSpeakerRole = (speakerId: string, role: string) => {
    if (transcript && transcript.speakers) {
      setTranscript({
        ...transcript,
        speakers: transcript.speakers.map((s: any) =>
          s.id === speakerId ? { ...s, role } : s
        )
      });
    }
  };

  const saveSpeakers = async () => {
    if (!transcript || !transcript.speakers) return;
    
    const jobIdForApi = currentJobId;
    if (!jobIdForApi) {
      console.error('No jobId available for saving speakers');
      return;
    }
    
    try {
      const speakerMappings = transcript.speakers.map((s: any) => ({
        speakerId: s.id,
        name: s.name,
        role: s.role
      }));
      
      const res = await fetch('/api/transcript/' + jobIdForApi + '/diarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ speakerMappings })
      });
      
      if (res.ok) {
        setEditingSpeakers(false);
        await fetchAnalysis(jobIdForApi);
      }
    } catch (error) {
      console.error('Error saving speakers:', error);
    }
  };

  const startEditingTranscript = () => {
    if (transcript && transcript.text) {
      setEditedSegments([...transcript.text]);
      setEditingTranscript(true);
    }
  };

  const cancelEditingTranscript = () => {
    setEditedSegments([]);
    setEditingTranscript(false);
  };

  const updateEditedSegment = (segmentId: string, field: string, value: any) => {
    setEditedSegments(prev => prev.map(seg => 
      seg.id === segmentId ? { ...seg, [field]: value } : seg
    ));
  };

  const saveEditedTranscript = async () => {
    if (!currentJobId || editedSegments.length === 0) return;

    try {
      const res = await fetch('/api/transcript/' + currentJobId + '/segments', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ segments: editedSegments })
      });

      if (res.ok) {
        setEditingTranscript(false);
        await fetchTranscript(currentJobId);
        await fetchAnalysis(currentJobId);
      }
    } catch (error) {
      console.error('Error saving transcript:', error);
    }
  };

  const fetchEmailDraft = async () => {
    if (!currentJobId) return;
    try {
      const res = await fetch('/api/email/' + currentJobId, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEmailDraft(data.emailDraft);
        setShowEmailModal(true);
      }
    } catch (error) {
      console.error('Error fetching email:', error);
    }
  };

  const copyEmailDraft = () => {
    if (emailDraft) {
      navigator.clipboard.writeText(emailDraft);
      alert('Email copied to clipboard!');
    }
  };

  const fetchMarkdownPreview = async () => {
    if (!job) return;
    try {
      const res = await fetch(`/api/export/${job.id}/preview`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMarkdownContent(data.markdown);
        setShowMarkdownModal(true);
      }
    } catch (error) {
      console.error('Error fetching markdown:', error);
    }
  };

  const copyMarkdown = () => {
    if (markdownContent) {
      navigator.clipboard.writeText(markdownContent);
      alert('Markdown copied to clipboard!');
    }
  };

  const pollJobStatus = (jobId: string) => {
    const MAX_RETRIES = 120;
    const POLL_INTERVAL = 1500;
    const MAX_POLL_TIME = MAX_RETRIES * POLL_INTERVAL;
    let retryCount = 0;
    let pollStartTime = Date.now();
    let isMounted = true;

    const poll = async () => {
      if (!isMounted) return;

      if (retryCount >= MAX_RETRIES || (Date.now() - pollStartTime) > MAX_POLL_TIME) {
        console.error('Polling timeout: job may be stuck');
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/jobs/${jobId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();

        if (!isMounted) return;

        if (data.status === 'PROCESSING') {
          setJob(data);
          retryCount++;
          setTimeout(poll, POLL_INTERVAL);
        } else if (data.status === 'COMPLETED') {
          setJob(data);
          setCurrentStep(3);
          fetchTranscript(jobId);
          fetchAnalysis(jobId);
        } else if (data.status === 'FAILED') {
          console.error('Job failed:', data.error);
          setLoading(false);
        } else {
          retryCount++;
          setTimeout(poll, POLL_INTERVAL);
        }
      } catch (error) {
        console.error('Error polling job:', error);
        if (isMounted) {
          retryCount++;
          setTimeout(poll, POLL_INTERVAL);
        }
      }
    };
    poll();

    return () => {
      isMounted = false;
    };
  };

  const generateAnalysis = async () => {
    if (!job) return;
    setLoading(true);
    setAnalysisProgress(0);

    try {
      const res = await fetch(`/api/analysis/${job.id}/generate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const MAX_RETRIES = 120;
        const POLL_INTERVAL = 1000;
        let retryCount = 0;
        let isMounted = true;

        const pollAnalysis = async () => {
          if (!isMounted || retryCount >= MAX_RETRIES) {
            if (isMounted) {
              console.error('Analysis polling timeout');
              setLoading(false);
            }
            return;
          }

          try {
            const jobRes = await fetch(`/api/jobs/${job.id}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            const jobData = await jobRes.json();
            if (!isMounted) return;
            setJob(jobData);
            setAnalysisProgress(jobData.progress || 0);

            if (jobData.status === 'PROCESSING') {
              retryCount++;
              setTimeout(pollAnalysis, POLL_INTERVAL);
            } else if (jobData.status === 'COMPLETED') {
              const analysisRes = await fetch(`/api/analysis/${job.id}`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              if (analysisRes.ok) {
                const analysisData = await analysisRes.json();
                setAnalysis(analysisData);
                setCurrentStep(4);
              }
              setLoading(false);
              setAnalysisProgress(100);
            } else if (jobData.status === 'FAILED') {
              console.error('Analysis job failed');
              setLoading(false);
            } else {
              retryCount++;
              setTimeout(pollAnalysis, POLL_INTERVAL);
            }
          } catch (error) {
            console.error('Error polling analysis:', error);
            if (isMounted) {
              retryCount++;
              setTimeout(pollAnalysis, POLL_INTERVAL);
            }
          }
        };
        pollAnalysis();

        return () => {
          isMounted = false;
        };
      }
    } catch (error) {
      console.error('Error generating analysis:', error);
      setLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setRecordedBlob(blob);
        setRecording(false);
      };

      mediaRecorder.start();
      setRecording(true);

      (window as any).currentMediaRecorder = mediaRecorder;
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = async () => {
    const mediaRecorder = (window as any).currentMediaRecorder;
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach((track: any) => track.stop());
    }
  };

  const uploadRecording = async () => {
    if (!recordedBlob) {
      console.error('No recorded blob found');
      return;
    }
    setLoading(true);
    console.log('Uploading recording, blob size:', recordedBlob.size);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      console.log('Base64 length:', base64.length);

      try {
        console.log('Sending request to /api/record');
        const res = await fetch('/api/record', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            filename: `Recording_${Date.now()}.webm`,
            audioData: base64,
            duration: 0
          })
        });
        console.log('Response status:', res.status);

        if (res.ok) {
          const data = await res.json();
          console.log('Job created:', data.job.id);
          setJob(data.job);
          setCurrentJob(data.job.id);
          setMethod('record');
          setCurrentStep(2);
          pollJobStatus(data.job.id);
        } else {
          console.error('Upload failed:', await res.text());
        }
      } catch (error) {
        console.error('Error uploading recording:', error);
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => console.error('FileReader error');
    reader.readAsDataURL(recordedBlob);
  };

  const downloadAudio = async () => {
    if (!job) return;
    try {
      const res = await fetch(`/api/jobs/${job.id}/download`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = job.fileName || 'audio';
        a.click();
        URL.revokeObjectURL(blobUrl);
      }
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  const downloadMindmap = async () => {
    if (!job) return;
    try {
      const res = await fetch(`/api/export/${job.id}/mindmap?format=png`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${job.fileName}_mindmap.png`;
        a.click();
        URL.revokeObjectURL(blobUrl);
      }
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  const exportData = async (format: string) => {
    if (!job) return;

    try {
      let url = `/api/export/${job.id}?format=${format}`;
      let filename = `${job.fileName}_report.${format}`;
      
      if (format === 'calendar') {
        url = `/api/export/${job.id}/calendar`;
        filename = `${job.fileName}_dates.ics`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(blobUrl);
      }
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-8">
      {job && job.status === 'COMPLETED' && (
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">{job.fileName}</h2>
          <p className="text-text-secondary mb-6">Transcripción completada</p>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={() => setCurrentStep(4)}
              className="px-6 py-3 rounded-xl bg-hero-gradient text-white font-semibold flex items-center gap-2"
            >
              <Eye className="w-5 h-5" />
              Ver análisis
            </button>
            <button
              onClick={() => setCurrentStep(3)}
              className="px-6 py-3 rounded-xl bg-background-secondary border border-border text-text-primary font-semibold flex items-center gap-2 hover:border-accent-purple transition-colors"
            >
              <FileText className="w-5 h-5" />
              Ver transcripción
            </button>
            <button
              onClick={handleDeleteJob}
              className="px-6 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-semibold flex items-center gap-2 hover:bg-red-500/20 transition-colors"
            >
              <Trash2 className="w-5 h-5" />
              Eliminar
            </button>
            <button
              onClick={() => {
                setJob(null);
                setCurrentJob(null);
                setCurrentStep(1);
              }}
              className="px-6 py-3 rounded-xl bg-accent-purple text-white font-semibold flex items-center gap-2 hover:bg-accent-purple/90 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Nuevo trabajo
            </button>
          </div>
        </div>
      )}

      {(!job || job.status !== 'COMPLETED') && (
        <>
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">¿Cómo quieres empezar?</h2>
            <p className="text-text-secondary">Sube un archivo o graba directamente</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <div
              {...getRootProps()}
              className={`p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${
                isDragActive 
                  ? 'border-accent-purple bg-accent-purple/10' 
                  : 'border-border hover:border-accent-purple/50 bg-background-secondary'
              }`}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-accent-purple/20 flex items-center justify-center mb-4">
                  <Upload className="w-8 h-8 text-accent-purple" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Subir archivo</h3>
                <p className="text-sm text-text-secondary">
                  Arrastra o selecciona archivos de audio/video
                </p>
                <p className="text-xs text-text-secondary mt-2">MP3, WAV, M4A, MP4</p>
              </div>
            </div>

            <div className="p-8 rounded-2xl border-2 border-dashed border-border hover:border-accent-cyan/50 bg-background-secondary transition-all">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-accent-cyan/20 flex items-center justify-center mb-4">
                  <Mic className="w-8 h-8 text-accent-cyan" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Grabar en vivo</h3>
                <p className="text-sm text-text-secondary mb-4">
                  Graba directamente desde tu navegador
                </p>

                {!recordedBlob ? (
                  <button
                    onClick={recording ? stopRecording : startRecording}
                    className={`px-6 py-2 rounded-full font-medium transition-all ${
                      recording 
                        ? 'bg-red-500 hover:bg-red-600 text-white' 
                        : 'bg-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/30'
                    }`}
                  >
                    {recording ? (
                      <span className="flex items-center gap-2">
                        <Square className="w-4 h-4" /> Detener
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Play className="w-4 h-4" /> Iniciar grabación
                      </span>
                    )}
                  </button>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-green-500/20 flex items-center justify-center">
                      <Check className="w-8 h-8 text-green-500" />
                    </div>
                    <p className="text-sm text-green-400">Grabación lista</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setRecordedBlob(null)}
                        className="px-4 py-2 rounded-lg bg-background text-text-secondary hover:text-text-primary transition-colors"
                      >
                        Descartar
                      </button>
                      <button
                        onClick={uploadRecording}
                        disabled={loading}
                        className="px-4 py-2 rounded-lg bg-accent-cyan text-white font-medium hover:bg-accent-cyan/90 transition-colors disabled:opacity-50"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Subir'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Transcripción en progreso</h2>
        <p className="text-text-secondary">
          {method === 'upload' ? job?.fileName : 'Grabación en vivo'}
        </p>
      </div>

      <div className="max-w-md mx-auto">
        <div className="relative h-2 rounded-full bg-background-secondary overflow-hidden mb-4">
          <div 
            className="absolute inset-y-0 left-0 bg-hero-gradient transition-all duration-500"
            style={{ width: `${job?.progress || 0}%` }}
          />
        </div>
        <p className="text-center text-sm text-text-secondary">
          {job?.progress || 0}% completado
        </p>
      </div>

      <div className="flex items-center justify-center gap-2 text-accent-purple">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Procesando con IA...</span>
      </div>
    </div>
  );

  const handleEditSpeakers = () => {
    if (editingSpeakers) {
      saveSpeakers();
    }
    setEditingSpeakers(!editingSpeakers);
  };

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Transcripción completada</h2>
        <p className="text-text-secondary">Revisa la transcripción y genera el análisis cuando estés listo</p>
      </div>

      {transcript && (
        <div className="max-w-3xl mx-auto bg-background-secondary rounded-xl border border-border p-6 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent-purple" />
              Transcripción
            </h3>
            <div className="flex gap-2">
              {!editingTranscript && (
                <button
                  onClick={() => setEditingSpeakers(!editingSpeakers)}
                  className="px-3 py-1 text-xs rounded-lg bg-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/30 transition-colors flex items-center gap-1"
                >
                  <Users className="w-3 h-3" />
                  {editingSpeakers ? 'Ocultar' : 'Editar interlocutores'}
                </button>
              )}
              {editingTranscript ? (
                <>
                  <button
                    onClick={cancelEditingTranscript}
                    className="px-3 py-1 text-xs rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    Cancelar
                  </button>
                  <button
                    onClick={saveEditedTranscript}
                    className="px-3 py-1 text-xs rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors flex items-center gap-1"
                  >
                    <Save className="w-3 h-3" />
                    Guardar
                  </button>
                </>
              ) : (
                <button
                  onClick={startEditingTranscript}
                  className="px-3 py-1 text-xs rounded-lg bg-accent-purple/20 text-accent-purple hover:bg-accent-purple/30 transition-colors flex items-center gap-1"
                >
                  <Edit2 className="w-3 h-3" />
                  Editar texto
                </button>
              )}
            </div>
          </div>

          {editingSpeakers && transcript.speakers && transcript.speakers.length > 0 && (
            <div className="mb-4 p-3 bg-background rounded-lg border border-border">
              <h4 className="text-sm font-medium mb-2">Interlocutores</h4>
              <div className="space-y-2">
                {(transcript.speakers as any[]).map((speaker) => (
                  <div key={speaker.id} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={speaker.name || ''}
                      onChange={(e) => updateSpeakerName(speaker.id, e.target.value)}
                      className="flex-1 px-2 py-1 text-sm bg-background-secondary border border-border rounded focus:outline-none focus:border-accent-purple"
                      placeholder="Nombre"
                    />
                    <input
                      type="text"
                      value={speaker.role || ''}
                      onChange={(e) => updateSpeakerRole(speaker.id, e.target.value)}
                      className="w-32 px-2 py-1 text-sm bg-background-secondary border border-border rounded focus:outline-none focus:border-accent-purple"
                      placeholder="Rol (opcional)"
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={saveSpeakers}
                className="mt-2 px-3 py-1 text-xs rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
              >
                Guardar interlocutores
              </button>
            </div>
          )}

          <div className="space-y-3">
            {(editingTranscript ? editedSegments : transcript.text)?.map((seg: TranscriptSegment, idx: number) => (
              <div key={seg.id} className="flex gap-3">
                <span className="text-xs text-text-secondary font-mono shrink-0">
                  {formatTime(seg.start)}
                </span>
                <div className="flex-1">
                  <span className="text-sm font-medium text-accent-cyan">
                    {transcript.speakers?.find((s: any) => s.id === seg.speakerId)?.name || 'Participante'}:
                  </span>
                  {editingTranscript ? (
                    <div className="mt-1">
                      <textarea
                        value={editedSegments.find(s => s.id === seg.id)?.content || ''}
                        onChange={(e) => updateEditedSegment(seg.id, 'content', e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:border-accent-purple resize-none"
                        rows={2}
                      />
                      <select
                        value={editedSegments.find(s => s.id === seg.id)?.speakerId || ''}
                        onChange={(e) => updateEditedSegment(seg.id, 'speakerId', e.target.value)}
                        className="mt-1 px-2 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:border-accent-purple"
                      >
                        <option value="">Sin asignar</option>
                        {transcript.speakers?.map((s: any) => (
                          <option key={s.id} value={s.id}>{s.name || 'Participante'}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <p className="text-sm">{seg.content}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-center">
        {loading && analysisProgress > 0 && analysisProgress < 100 && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm text-text-secondary mb-1">
              <span>Generando análisis...</span>
              <span>{analysisProgress}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className="bg-hero-gradient h-2 rounded-full transition-all duration-300"
                style={{ width: `${analysisProgress}%` }}
              />
            </div>
          </div>
        )}
        <button
          onClick={generateAnalysis}
          disabled={loading && analysisProgress > 0}
          className="px-8 py-3 rounded-xl bg-hero-gradient text-white font-semibold disabled:opacity-50"
        >
          {loading && analysisProgress > 0 ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Procesando...
            </span>
          ) : loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Generando análisis...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Generar análisis con IA
            </span>
          )}
        </button>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-8">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-400" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Análisis completado</h2>
        <p className="text-text-secondary">Descarga tus resultados en el formato que prefieras</p>
      </div>

      {analysis && (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <AnalysisCard 
              icon={<Brain className="w-5 h-5" />}
              title="Resumen ejecutivo"
              items={[analysis.summary || '']}
              color="purple"
            />
            <AnalysisCard 
              icon={<ListTodo className="w-5 h-5" />}
              title="Puntos clave"
              items={analysis.keyPoints || []}
              color="cyan"
            />
            <AnalysisCard 
              icon={<CheckCircle2 className="w-5 h-5" />}
              title="Decisiones"
              items={analysis.decisions || []}
              color="green"
            />
            <AnalysisCard 
              icon={<AlertTriangle className="w-5 h-5" />}
              title="Riesgos"
              items={analysis.risks || []}
              color="yellow"
            />
          </div>

          {analysis.tasks && analysis.tasks.length > 0 && (
            <div className="bg-background-secondary rounded-xl border border-border p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <ListTodo className="w-5 h-5 text-accent-purple" />
                Tareas accionables
              </h3>
              <div className="space-y-3">
                {analysis.tasks.map((task) => (
                  <div key={task.id} className="p-3 rounded-lg bg-background">
                    <div className="flex items-start gap-3">
                      <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        task.priority === 'HIGH' ? 'bg-red-500' :
                        task.priority === 'MEDIUM' ? 'bg-yellow-500' : 'bg-green-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm block" style={{ wordBreak: 'break-word' }}>{task.description}</span>
                        <div className="flex items-center gap-4 text-xs text-text-secondary mt-1">
                          {task.owner && <span>{task.owner}</span>}
                          {task.dueDate && <span>{new Date(task.dueDate).toLocaleDateString()}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysis.dates && analysis.dates.length > 0 && (
            <div className="bg-background-secondary rounded-xl border border-border p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-accent-cyan" />
                Fechas detectadas
              </h3>
              <div className="grid md:grid-cols-2 gap-3">
                {analysis.dates.map((date) => (
                  <div key={date.id} className="flex items-start gap-3 p-3 rounded-lg bg-background">
                    <Calendar className="w-4 h-4 text-accent-cyan shrink-0 mt-0.5" />
                    <div style={{ wordBreak: 'break-word' }}>
                      <span className="text-sm font-medium block">
                        {new Date(date.date).toLocaleDateString('es-ES', {
                          weekday: 'long', day: 'numeric', month: 'long'
                        })}
                      </span>
                      {date.description && (
                        <p className="text-xs text-text-secondary" style={{ wordBreak: 'break-word' }}>{date.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(analysis.mindmap || analysis.summary) && (
            <div className="bg-background-secondary rounded-xl border border-border p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Map className="w-5 h-5 text-accent-purple" />
                Mapa mental
                {analysis.mindmap && <span className="text-xs text-gray-400">({analysis.mindmap.length} chars)</span>}
              </h3>
              {analysis.mindmap ? (
                <div className="bg-white rounded-lg p-4 overflow-x-auto">
                  <Mermaid chart={analysis.mindmap} />
                </div>
              ) : (
                <p className="text-gray-400">No hay mapa mental disponible</p>
              )}
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={downloadAudio}
              className="px-4 py-2 rounded-lg bg-accent-cyan text-white hover:bg-accent-cyan/80 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span className="uppercase text-sm font-medium">Audio</span>
            </button>
            <button
              onClick={() => exportData('txt')}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              <span className="uppercase text-sm font-medium">TXT</span>
            </button>
            <button
              onClick={fetchMarkdownPreview}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-white transition-colors flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              <span className="uppercase text-sm font-medium">Preview MD</span>
            </button>
            <button
              onClick={async () => {
                if (!job) return;
                try {
                  const res = await fetch(`/api/export/${job.id}/pdf`, {
                    headers: { Authorization: `Bearer ${token}` }
                  });
                  if (res.ok) {
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    window.open(url, '_blank');
                  }
                } catch (error) {
                  console.error('Error opening PDF:', error);
                }
              }}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              <span className="uppercase text-sm font-medium">PDF</span>
            </button>
            <button
              onClick={() => exportData('calendar')}
              className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition-colors flex items-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              <span className="uppercase text-sm font-medium">ICS</span>
            </button>
            <button
              onClick={downloadMindmap}
              className="px-4 py-2 rounded-lg bg-accent-purple text-white hover:bg-accent-purple/80 transition-colors flex items-center gap-2"
            >
              <Map className="w-4 h-4" />
              <span className="uppercase text-sm font-medium">Mapa</span>
            </button>
            <button
              onClick={fetchEmailDraft}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-colors flex items-center gap-2"
            >
              <Mail className="w-4 h-4" />
              <span className="uppercase text-sm font-medium">Email</span>
            </button>
          </div>
          {showEmailModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-background-secondary rounded-xl border border-border p-6 max-w-2xl w-full max-h-[80vh] overflow-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold">Email Draft</h3>
                  <button onClick={() => setShowEmailModal(false)} className="text-text-secondary hover:text-text-primary">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <pre className="text-sm whitespace-pre-wrap bg-background p-4 rounded-lg border border-border mb-4" style={{ wordBreak: 'break-word' }}>{emailDraft}</pre>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowEmailModal(false)} className="px-4 py-2 rounded-lg border border-border hover:bg-background transition-colors">Cerrar</button>
                  <button onClick={copyEmailDraft} className="px-4 py-2 rounded-lg bg-accent-purple text-white hover:bg-accent-purple/80 transition-colors">Copiar</button>
                </div>
              </div>
            </div>
          )}
          {showMarkdownModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-background-secondary rounded-xl border border-border p-6 max-w-3xl w-full max-h-[80vh] overflow-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold">Markdown Preview</h3>
                  <button onClick={() => setShowMarkdownModal(false)} className="text-text-secondary hover:text-text-primary">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="bg-background p-4 rounded-lg border border-border mb-4 max-h-[60vh] overflow-auto prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{markdownContent || ''}</ReactMarkdown>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowMarkdownModal(false)} className="px-4 py-2 rounded-lg border border-border hover:bg-background transition-colors">Cerrar</button>
                  <button onClick={copyMarkdown} className="px-4 py-2 rounded-lg bg-accent-purple text-white hover:bg-accent-purple/80 transition-colors">Copiar Markdown</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background-secondary/50 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={goBack} className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors">
            <ArrowLeft className="w-5 h-5" />
            Volver
          </button>
          <span className="text-xl font-bold gradient-text">Transcribe AI</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <Stepper steps={steps} currentStep={currentStep} />

        <div className="mt-12">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
        </div>
      </main>
    </div>
  );
}

function Stepper({ steps, currentStep }: { steps: any[]; currentStep: Step }) {
  return (
    <div className="flex items-center justify-center">
      {steps.map((step, index) => (
        <div key={step.number} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold transition-all ${
              currentStep > step.number 
                ? 'bg-green-500 text-white' 
                : currentStep === step.number 
                  ? 'bg-hero-gradient text-white' 
                  : 'bg-background-secondary border border-border text-text-secondary'
            }`}>
              {currentStep > step.number ? (
                <Check className="w-6 h-6" />
              ) : (
                step.number
              )}
            </div>
            <div className="mt-2 text-center">
              <p className={`text-sm font-medium ${currentStep >= step.number ? 'text-text-primary' : 'text-text-secondary'}`}>
                {step.title}
              </p>
              <p className="text-xs text-text-secondary">{step.description}</p>
            </div>
          </div>

          {index < steps.length - 1 && (
            <div className={`w-20 h-1 mx-2 rounded ${
              currentStep > step.number ? 'bg-green-500' : 'bg-border'
            }`} />
          )}
        </div>
      ))}
    </div>
  );
}

function AnalysisCard({ icon, title, items, color }: { icon: React.ReactNode; title: string; items: string[]; color: string }) {
  const colorClasses = {
    purple: 'text-accent-purple bg-accent-purple/20',
    cyan: 'text-accent-cyan bg-accent-cyan/20',
    green: 'text-green-400 bg-green-400/20',
    yellow: 'text-yellow-400 bg-yellow-400/20',
  };

  return (
    <div className="bg-background-secondary rounded-xl border border-border p-6">
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        <span className={`p-2 rounded-lg ${colorClasses[color as keyof typeof colorClasses]}`}>
          {icon}
        </span>
        {title}
      </h3>
      <ul className="space-y-2">
        {items.slice(0, 5).map((item, i) => (
          <li key={i} className="text-sm text-text-secondary flex items-start gap-2">
            <span className="text-accent-purple mt-1 shrink-0">•</span>
            <span style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
