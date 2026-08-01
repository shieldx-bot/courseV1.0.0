{{- define "platform-base.labels" -}}
app.kubernetes.io/part-of: ascendly
app.kubernetes.io/managed-by: helm
{{- end -}}

app.kubernetes.io/version: {{ .Chart.AppVersion }}
