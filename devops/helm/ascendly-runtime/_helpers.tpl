{{- define "ascendly-runtime.labels" -}}
app.kubernetes.io/name: ascendly
app.kubernetes.io/part-of: ascendly
app.kubernetes.io/managed-by: helm
app.kubernetes.io/version: {{ .Chart.AppVersion }}
{{- end -}}
