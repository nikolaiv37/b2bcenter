import { useState, useCallback, useEffect, useImperativeHandle, forwardRef } from 'react'
import { Upload, FileText, X } from 'lucide-react'
import { GlassCard } from './GlassCard'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface CSVUploaderProps {
  onFileSelect: (file: File) => void
  isUploading?: boolean
  progress?: number
  className?: string
  resetKey?: number // Add reset key to force reset
}

export const CSVUploader = forwardRef<{ reset: () => void }, CSVUploaderProps>(
  function CSVUploader(
    {
      onFileSelect,
      isUploading = false,
      progress = 0,
      className,
      resetKey,
    },
    ref
  ) {
    const [dragActive, setDragActive] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)

    // Reset when resetKey changes
    useEffect(() => {
      if (resetKey !== undefined && resetKey > 0) {
        setSelectedFile(null)
        const fileInput = document.getElementById('csv-upload') as HTMLInputElement
        if (fileInput) {
          fileInput.value = ''
        }
      }
    }, [resetKey])

    // Expose reset function via ref
    useImperativeHandle(ref, () => ({
      reset: () => {
        setSelectedFile(null)
        const fileInput = document.getElementById('csv-upload') as HTMLInputElement
        if (fileInput) {
          fileInput.value = ''
        }
      },
    }))

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        const file = e.dataTransfer.files[0]
        if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
          setSelectedFile(file)
          onFileSelect(file)
        }
      }
    },
    [onFileSelect]
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.preventDefault()
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0]
        setSelectedFile(file)
        onFileSelect(file)
      }
    },
    [onFileSelect]
  )

  const handleRemove = () => {
    setSelectedFile(null)
  }

  return (
    <GlassCard className={cn('relative', className)}>
      <div
        className={cn(
          'relative border-2 border-dashed rounded-lg p-8 transition-colors',
          dragActive
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50',
          isUploading && 'pointer-events-none opacity-50'
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="csv-upload"
          accept=".csv"
          onChange={handleChange}
          className="hidden"
          disabled={isUploading}
        />

        {!selectedFile ? (
          <label
            htmlFor="csv-upload"
            className="flex flex-col items-center justify-center cursor-pointer"
          >
            <Upload className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold mb-2">
              Drop your CSV file here or click to browse
            </p>
            <p className="text-sm text-muted-foreground">
              Accepts .csv files with product data
            </p>
          </label>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-primary" />
                <div>
                  <p className="font-semibold">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              </div>
              {!isUploading && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRemove}
                  className="h-8 w-8"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>

            {isUploading && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-sm text-center text-muted-foreground">
                  Uploading... {progress}%
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </GlassCard>
  )
  }
)

