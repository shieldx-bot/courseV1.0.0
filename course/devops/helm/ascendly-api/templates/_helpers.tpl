{{- define "ascendly-api.labels" -}}
app: ascendly-api
app.kubernetes.io/name: ascendly
app.kubernetes.io/instance: ascendly-api
app.kubernetes.io/component: api
app.kubernetes.io/part-of: ascendly
app.kubernetes.io/managed-by: helm
app.kubernetes.io/version: {{ .Chart.AppVersion }}
{{- end -}}
