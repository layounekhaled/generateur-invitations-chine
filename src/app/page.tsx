'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import {
  FileText,
  Download,
  Eye,
  Upload,
  History,
  Copy,
  Trash2,
  Search,
  Plus,
  Loader2,
  ChevronRight,
  FileSpreadsheet,
  Users,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'

// Types
interface InvitationForm {
  template: string
  lastName: string
  firstName: string
  sex: string
  dateOfBirth: string
  nationality: string
  passportNumber: string
  arrivalDate: string
  departureDate: string
  visitPurpose: string
  cityToVisit: string
  inviterRelation: string
  fundingSource: string
  notes: string
}

interface InvitationRecord {
  id: string
  template: string
  lastName: string
  firstName: string
  sex: string
  dateOfBirth: string
  nationality: string
  passportNumber: string
  arrivalDate: string
  departureDate: string
  visitPurpose: string
  cityToVisit: string
  inviterRelation: string
  fundingSource: string
  notes: string
  pdfGenerated: boolean
  createdAt: string
}

const emptyForm: InvitationForm = {
  template: 'houacine',
  lastName: '',
  firstName: '',
  sex: 'M',
  dateOfBirth: '',
  nationality: 'Algeria',
  passportNumber: '',
  arrivalDate: '',
  departureDate: '',
  visitPurpose: '商务洽谈',
  cityToVisit: '广州',
  inviterRelation: '客户',
  fundingSource: '客户本人',
  notes: '',
}

const nationalityOptions = [
  'Algeria', 'France', 'Morocco', 'Tunisia', 'Egypt', 'Libya', 'Mauritania',
  'Senegal', 'Mali', 'Niger', 'Chad', 'Sudan', 'Iraq', 'Iran', 'Turkey',
  'Pakistan', 'India', 'Bangladesh', 'Indonesia', 'Malaysia', 'Thailand',
  'Vietnam', 'Philippines', 'Russia', 'Ukraine', 'Kazakhstan', 'Uzbekistan',
  'Nigeria', 'Ghana', 'Cameroon', 'Ethiopia', 'Kenya', 'Tanzania',
  'South Africa', 'Congo', 'Angola', 'Mozambique', 'Madagascar',
]

export default function Home() {
  const [form, setForm] = useState<InvitationForm>({ ...emptyForm })
  const [activeTab, setActiveTab] = useState('create')
  const [loading, setLoading] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [history, setHistory] = useState<InvitationRecord[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [importData, setImportData] = useState<InvitationForm[]>([])
  const [importLoading, setImportLoading] = useState(false)
  const [bulkMode, setBulkMode] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const updateForm = useCallback((field: keyof InvitationForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }, [])

  // Save to history (localStorage)
  const saveToHistory = useCallback((invitation: InvitationForm) => {
    const record: InvitationRecord = {
      ...invitation,
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      pdfGenerated: true,
      createdAt: new Date().toISOString(),
    }
    const stored = JSON.parse(localStorage.getItem('invitation_history') || '[]')
    stored.unshift(record)
    localStorage.setItem('invitation_history', JSON.stringify(stored.slice(0, 500)))
    loadHistory()
  }, [])

  const loadHistory = useCallback(() => {
    const stored = JSON.parse(localStorage.getItem('invitation_history') || '[]')
    setHistory(stored)
  }, [])

  // Generate PDF
  const handleGeneratePDF = useCallback(async (data?: InvitationForm) => {
    const formData = data || form
    if (!formData.lastName || !formData.firstName || !formData.passportNumber || !formData.arrivalDate || !formData.departureDate) {
      toast({
        title: 'Champs obligatoires manquants',
        description: 'Veuillez remplir le nom, prénom, numéro de passeport et les dates.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) throw new Error('Erreur de génération PDF')

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `invitation_${formData.lastName}_${formData.firstName}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      saveToHistory(formData)
      toast({
        title: 'PDF généré avec succès',
        description: `Invitation pour ${formData.firstName} ${formData.lastName} téléchargée.`,
      })
    } catch (error) {
      console.error(error)
      toast({
        title: 'Erreur',
        description: 'Impossible de générer le PDF. Veuillez réessayer.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [form, saveToHistory, toast])

  // Preview
  const handlePreview = useCallback(async () => {
    if (!form.lastName || !form.firstName) {
      toast({
        title: 'Champs obligatoires',
        description: 'Veuillez remplir au moins le nom et le prénom.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/generate-html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!response.ok) throw new Error('Erreur de prévisualisation')

      const html = await response.text()
      setPreviewHtml(html)
      setShowPreview(true)
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de générer l\'aperçu.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [form, toast])

  // CSV Import
  const handleFileImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportLoading(true)
    try {
      const Papa = (await import('papaparse')).default
      const XLSX = (await import('xlsx')).default

      let rows: Record<string, string>[] = []

      if (file.name.endsWith('.csv')) {
        const text = await file.text()
        const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true })
        rows = result.data
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        rows = XLSX.utils.sheet_to_json<Record<string, string>>(workbook.Sheets[sheetName])
      } else {
        toast({
          title: 'Format non supporté',
          description: 'Veuillez utiliser un fichier CSV ou Excel (.xlsx).',
          variant: 'destructive',
        })
        return
      }

      const imported: InvitationForm[] = rows.map(row => ({
        template: form.template,
        lastName: row['Nom'] || row['nom'] || row['lastName'] || row['last_name'] || '',
        firstName: row['Prénom'] || row['prenom'] || row['firstName'] || row['first_name'] || '',
        sex: row['Sexe'] || row['sexe'] || row['sex'] || row['gender'] || 'M',
        dateOfBirth: row['Date naissance'] || row['date_naissance'] || row['dateOfBirth'] || row['date_of_birth'] || '',
        nationality: row['Nationalité'] || row['nationalite'] || row['nationality'] || 'Algeria',
        passportNumber: row['Passeport'] || row['passeport'] || row['passportNumber'] || row['passport_number'] || row['passport'] || '',
        arrivalDate: row['Date arrivée'] || row['date_arrivee'] || row['arrivalDate'] || row['arrival_date'] || '',
        departureDate: row['Date départ'] || row['date_depart'] || row['departureDate'] || row['departure_date'] || '',
        visitPurpose: row['Objet visite'] || row['objet_visite'] || row['visitPurpose'] || row['visit_purpose'] || '商务洽谈',
        cityToVisit: row['Ville'] || row['ville'] || row['cityToVisit'] || row['city'] || '广州',
        inviterRelation: row['Relation'] || row['relation'] || row['inviterRelation'] || '客户',
        fundingSource: row['Financement'] || row['financement'] || row['fundingSource'] || row['funding'] || '客户本人',
        notes: row['Notes'] || row['notes'] || '',
      }))

      setImportData(imported)
      toast({
        title: 'Fichier importé',
        description: `${imported.length} personne(s) trouvée(s) dans le fichier.`,
      })
    } catch (error) {
      console.error(error)
      toast({
        title: 'Erreur d\'import',
        description: 'Impossible de lire le fichier. Vérifiez le format.',
        variant: 'destructive',
      })
    } finally {
      setImportLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [form.template, toast])

  // Bulk generate
  const handleBulkGenerate = useCallback(async () => {
    if (importData.length === 0) return

    setImportLoading(true)
    let successCount = 0
    let errorCount = 0

    if (bulkMode) {
      // Generate one PDF per person
      for (const data of importData) {
        try {
          const response = await fetch('/api/generate-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          })

          if (response.ok) {
            const blob = await response.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `invitation_${data.lastName}_${data.firstName}.pdf`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
            saveToHistory(data)
            successCount++
            // Small delay to avoid browser blocking
            await new Promise(r => setTimeout(r, 500))
          } else {
            errorCount++
          }
        } catch {
          errorCount++
        }
      }
    } else {
      // Generate all in one PDF (sequential pages)
      try {
        const response = await fetch('/api/generate-bulk-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invitations: importData }),
        })

        if (response.ok) {
          const blob = await response.blob()
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `invitations_groupe_${new Date().toISOString().split('T')[0]}.pdf`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
          importData.forEach(d => saveToHistory(d))
          successCount = importData.length
        } else {
          errorCount = importData.length
        }
      } catch {
        errorCount = importData.length
      }
    }

    setImportLoading(false)
    toast({
      title: 'Génération terminée',
      description: `${successCount} PDF généré(s) avec succès.${errorCount > 0 ? ` ${errorCount} erreur(s).` : ''}`,
      variant: errorCount > 0 ? 'destructive' : undefined,
    })
  }, [importData, bulkMode, saveToHistory, toast])

  // Duplicate from history
  const handleDuplicate = useCallback((record: InvitationRecord) => {
    setForm({
      template: record.template,
      lastName: record.lastName,
      firstName: record.firstName,
      sex: record.sex,
      dateOfBirth: record.dateOfBirth,
      nationality: record.nationality,
      passportNumber: record.passportNumber,
      arrivalDate: record.arrivalDate,
      departureDate: record.departureDate,
      visitPurpose: record.visitPurpose,
      cityToVisit: record.cityToVisit,
      inviterRelation: record.inviterRelation,
      fundingSource: record.fundingSource,
      notes: record.notes || '',
    })
    setActiveTab('create')
    toast({ title: 'Invitation dupliquée', description: 'Vous pouvez modifier les données avant de générer.' })
  }, [toast])

  // Delete from history
  const handleDeleteHistory = useCallback((id: string) => {
    const stored = JSON.parse(localStorage.getItem('invitation_history') || '[]')
    const filtered = stored.filter((r: InvitationRecord) => r.id !== id)
    localStorage.setItem('invitation_history', JSON.stringify(filtered))
    loadHistory()
    toast({ title: 'Supprimé', description: 'L\'invitation a été supprimée de l\'historique.' })
  }, [loadHistory, toast])

  // Re-download from history
  const handleRedownload = useCallback(async (record: InvitationRecord) => {
    setLoading(true)
    try {
      const formData: InvitationForm = {
        template: record.template,
        lastName: record.lastName,
        firstName: record.firstName,
        sex: record.sex,
        dateOfBirth: record.dateOfBirth,
        nationality: record.nationality,
        passportNumber: record.passportNumber,
        arrivalDate: record.arrivalDate,
        departureDate: record.departureDate,
        visitPurpose: record.visitPurpose,
        cityToVisit: record.cityToVisit,
        inviterRelation: record.inviterRelation,
        fundingSource: record.fundingSource,
        notes: record.notes || '',
      }

      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) throw new Error()

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `invitation_${record.lastName}_${record.firstName}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      toast({
        title: 'Erreur',
        description: 'Impossible de régénérer le PDF.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  // Filtered history
  const filteredHistory = history.filter((r) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      r.lastName.toLowerCase().includes(q) ||
      r.firstName.toLowerCase().includes(q) ||
      r.passportNumber.toLowerCase().includes(q)
    )
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Générateur d&apos;invitations Chine</h1>
                <p className="text-xs text-gray-500">Invitation professionnelle pour visa chinois</p>
              </div>
            </div>
            <Badge variant="outline" className="hidden sm:flex gap-1 text-xs">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              Prêt
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (v === 'history') loadHistory(); }}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="create" className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Créer</span>
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-2">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Import</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Historique</span>
            </TabsTrigger>
          </TabsList>

          {/* CREATE TAB */}
          <TabsContent value="create">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form */}
              <div className="lg:col-span-2 space-y-6">
                {/* Template Selection */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4 text-red-600" />
                      Modèle d&apos;invitation
                    </CardTitle>
                    <CardDescription>Sélectionnez le modèle de document</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <button
                        onClick={() => updateForm('template', 'houacine')}
                        className={`p-4 rounded-lg border-2 text-left transition-all ${
                          form.template === 'houacine'
                            ? 'border-red-600 bg-red-50 shadow-sm'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-semibold text-sm">HOUACINE</div>
                        <div className="text-xs text-gray-500 mt-1">Modèle standard avec en-tête rouge</div>
                        <div className="text-xs text-gray-400 mt-1">Style classique chinois</div>
                      </button>
                      <button
                        onClick={() => updateForm('template', 'akkak')}
                        className={`p-4 rounded-lg border-2 text-left transition-all ${
                          form.template === 'akkak'
                            ? 'border-blue-600 bg-blue-50 shadow-sm'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-semibold text-sm">AKKAK</div>
                        <div className="text-xs text-gray-500 mt-1">Modèle premium avec encadré bleu</div>
                        <div className="text-xs text-gray-400 mt-1">Style professionnel détaillé</div>
                      </button>
                    </div>
                  </CardContent>
                </Card>

                {/* Personal Info */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Informations personnelles</CardTitle>
                    <CardDescription>Renseignez les détails de la personne invitée</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Nom *</Label>
                        <Input
                          id="lastName"
                          placeholder="Ex: HOUACINE"
                          value={form.lastName}
                          onChange={(e) => updateForm('lastName', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="firstName">Prénom *</Label>
                        <Input
                          id="firstName"
                          placeholder="Ex: ABDESSALAM"
                          value={form.firstName}
                          onChange={(e) => updateForm('firstName', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Sexe</Label>
                      <RadioGroup value={form.sex} onValueChange={(v) => updateForm('sex', v)} className="flex gap-6">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="M" id="male" />
                          <Label htmlFor="male" className="font-normal">Masculin</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="F" id="female" />
                          <Label htmlFor="female" className="font-normal">Féminin</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="dateOfBirth">Date de naissance *</Label>
                        <Input
                          id="dateOfBirth"
                          type="date"
                          value={form.dateOfBirth}
                          onChange={(e) => updateForm('dateOfBirth', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="nationality">Nationalité *</Label>
                        <Select value={form.nationality} onValueChange={(v) => updateForm('nationality', v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner" />
                          </SelectTrigger>
                          <SelectContent>
                            {nationalityOptions.map((n) => (
                              <SelectItem key={n} value={n}>{n}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="passportNumber">Numéro de passeport *</Label>
                      <Input
                        id="passportNumber"
                        placeholder="Ex: 186159637"
                        value={form.passportNumber}
                        onChange={(e) => updateForm('passportNumber', e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Visit Info */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Détails de la visite</CardTitle>
                    <CardDescription>Informations relatives au séjour en Chine</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="arrivalDate">Date d&apos;arrivée *</Label>
                        <Input
                          id="arrivalDate"
                          type="date"
                          value={form.arrivalDate}
                          onChange={(e) => updateForm('arrivalDate', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="departureDate">Date de départ *</Label>
                        <Input
                          id="departureDate"
                          type="date"
                          value={form.departureDate}
                          onChange={(e) => updateForm('departureDate', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="visitPurpose">Objet de la visite</Label>
                        <Select value={form.visitPurpose} onValueChange={(v) => updateForm('visitPurpose', v)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="商务洽谈">Négociation commerciale</SelectItem>
                            <SelectItem value="采购订货">Achat et commande</SelectItem>
                            <SelectItem value="技术交流">Échange technique</SelectItem>
                            <SelectItem value="参观考察">Visite et inspection</SelectItem>
                            <SelectItem value="展会参展">Participation salon</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cityToVisit">Ville à visiter</Label>
                        <Select value={form.cityToVisit} onValueChange={(v) => updateForm('cityToVisit', v)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="广州">Guangzhou (广州)</SelectItem>
                            <SelectItem value="佛山">Foshan (佛山)</SelectItem>
                            <SelectItem value="深圳">Shenzhen (深圳)</SelectItem>
                            <SelectItem value="上海">Shanghai (上海)</SelectItem>
                            <SelectItem value="北京">Beijing (北京)</SelectItem>
                            <SelectItem value="义乌">Yiwu (义乌)</SelectItem>
                            <SelectItem value="杭州">Hangzhou (杭州)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="inviterRelation">Relation avec l&apos;invitant</Label>
                        <Select value={form.inviterRelation} onValueChange={(v) => updateForm('inviterRelation', v)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="客户">Client</SelectItem>
                            <SelectItem value="合作伙伴">Partenaire</SelectItem>
                            <SelectItem value="供应商">Fournisseur</SelectItem>
                            <SelectItem value="代理商">Agent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fundingSource">Source de financement</Label>
                        <Select value={form.fundingSource} onValueChange={(v) => updateForm('fundingSource', v)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="客户本人">Le client lui-même</SelectItem>
                            <SelectItem value="邀请公司">Entreprise invitante</SelectItem>
                            <SelectItem value="第三方">Tiers</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes supplémentaires</Label>
                      <Textarea
                        id="notes"
                        placeholder="Informations complémentaires (optionnel)"
                        value={form.notes}
                        onChange={(e) => updateForm('notes', e.target.value)}
                        rows={3}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => handlePreview()}
                    disabled={loading}
                    variant="outline"
                    className="flex-1 min-w-[140px]"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                    Aperçu
                  </Button>
                  <Button
                    onClick={() => handleGeneratePDF()}
                    disabled={loading}
                    className="flex-1 min-w-[140px] bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                    Télécharger PDF
                  </Button>
                  <Button
                    onClick={() => setForm({ ...emptyForm, template: form.template })}
                    variant="ghost"
                    className="min-w-[100px]"
                  >
                    Réinitialiser
                  </Button>
                </div>
              </div>

              {/* Side Panel */}
              <div className="space-y-6">
                {/* Quick Info */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Résumé</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Modèle:</span>
                      <span className="font-medium">{form.template === 'houacine' ? 'HOUACINE' : 'AKKAK'}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-gray-500">Nom complet:</span>
                      <span className="font-medium">{form.firstName} {form.lastName || '—'}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-gray-500">Passeport:</span>
                      <span className="font-medium">{form.passportNumber || '—'}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-gray-500">Séjour:</span>
                      <span className="font-medium">
                        {form.arrivalDate && form.departureDate
                          ? `${Math.ceil((new Date(form.departureDate).getTime() - new Date(form.arrivalDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} jour(s)`
                          : '—'}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Itinerary Preview */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Programme auto-généré</CardTitle>
                    <CardDescription>Basé sur les dates saisies</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {form.arrivalDate && form.departureDate ? (
                      <div className="space-y-2 text-xs">
                        {(() => {
                          const arrival = new Date(form.arrivalDate)
                          const departure = new Date(form.departureDate)
                          const totalDays = Math.ceil((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24)) + 1
                          const city = form.cityToVisit || '广州'

                          if (totalDays <= 0) return <p className="text-red-500">Dates invalides</p>

                          const items = []
                          if (totalDays >= 1) items.push({ day: 'Jour 1', desc: `Arrivée ${city}`, icon: '✈️' })
                          if (totalDays >= 2) items.push({ day: 'Jour 2', desc: 'Visite entreprise', icon: '🏢' })
                          if (totalDays >= 4) items.push({ day: `Jours 3-${totalDays - 2}`, desc: 'Activités commerciales', icon: '🏭' })
                          else if (totalDays >= 3) items.push({ day: 'Jour 3', desc: 'Activités commerciales', icon: '🏭' })
                          if (totalDays >= 4) items.push({ day: `Jour ${totalDays - 1}`, desc: 'Visite logistique', icon: '🚚' })
                          if (totalDays >= 3) items.push({ day: `Jour ${totalDays}`, desc: 'Départ', icon: '🛫' })
                          else if (totalDays >= 2) items.push({ day: 'Jour 2', desc: 'Départ', icon: '🛫' })

                          return items.map((item, i) => (
                            <div key={i} className="flex items-start gap-2 p-2 bg-gray-50 rounded">
                              <span>{item.icon}</span>
                              <div>
                                <div className="font-medium">{item.day}</div>
                                <div className="text-gray-500">{item.desc}</div>
                              </div>
                            </div>
                          ))
                        })()}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-4">
                        Saisissez les dates pour voir le programme
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Tips */}
                <Card className="bg-amber-50 border-amber-200">
                  <CardContent className="pt-4">
                    <div className="flex gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <div className="text-xs text-amber-800 space-y-1">
                        <p className="font-medium">Conseils</p>
                        <ul className="list-disc list-inside space-y-0.5">
                          <li>Le programme se génère automatiquement selon les dates</li>
                          <li>Vérifiez les informations avant de générer</li>
                          <li>Utilisez l&apos;onglet Import pour les listes CSV/Excel</li>
                          <li>Le PDF est au format A4 prêt à imprimer</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* IMPORT TAB */}
          <TabsContent value="import">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-green-600" />
                    Import de liste
                  </CardTitle>
                  <CardDescription>
                    Importez un fichier CSV ou Excel pour générer des invitations en masse.
                    Chaque ligne du fichier correspond à une personne.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Template selection for import */}
                  <div className="space-y-2">
                    <Label>Modèle pour l&apos;import</Label>
                    <Select value={form.template} onValueChange={(v) => updateForm('template', v)}>
                      <SelectTrigger className="w-64">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="houacine">HOUACINE (rouge)</SelectItem>
                        <SelectItem value="akkak">AKKAK (bleu)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* File Upload Area */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
                  >
                    <Upload className="h-10 w-10 mx-auto text-gray-400 mb-3" />
                    <p className="font-medium text-gray-700">
                      {importLoading ? 'Chargement...' : 'Cliquez pour sélectionner un fichier'}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">CSV ou Excel (.xlsx, .xls)</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileImport}
                    className="hidden"
                  />

                  {/* Expected columns */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm font-medium mb-2">Colonnes attendues dans le fichier :</p>
                    <div className="flex flex-wrap gap-2">
                      {['Nom', 'Prénom', 'Sexe', 'Date naissance', 'Nationalité', 'Passeport', 'Date arrivée', 'Date départ', 'Objet visite', 'Ville', 'Relation', 'Financement', 'Notes'].map(col => (
                        <Badge key={col} variant="secondary" className="text-xs">{col}</Badge>
                      ))}
                    </div>
                  </div>

                  {/* Import Results */}
                  {importData.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-green-600" />
                          <span className="font-medium">{importData.length} personne(s) importée(s)</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setImportData([])}>
                          Effacer
                        </Button>
                      </div>

                      <ScrollArea className="max-h-64 rounded-lg border">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="p-2 text-left">#</th>
                              <th className="p-2 text-left">Nom</th>
                              <th className="p-2 text-left">Prénom</th>
                              <th className="p-2 text-left">Passeport</th>
                              <th className="p-2 text-left">Arrivée</th>
                              <th className="p-2 text-left">Départ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importData.map((d, i) => (
                              <tr key={i} className="border-t hover:bg-gray-50">
                                <td className="p-2">{i + 1}</td>
                                <td className="p-2">{d.lastName}</td>
                                <td className="p-2">{d.firstName}</td>
                                <td className="p-2">{d.passportNumber}</td>
                                <td className="p-2">{d.arrivalDate}</td>
                                <td className="p-2">{d.departureDate}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </ScrollArea>

                      {/* Generation Mode */}
                      <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                        <p className="font-medium text-sm">Mode de génération :</p>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="bulkMode"
                              checked={!bulkMode}
                              onChange={() => setBulkMode(false)}
                              className="accent-blue-600"
                            />
                            <span className="text-sm">Un seul PDF (toutes les invitations)</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="bulkMode"
                              checked={bulkMode}
                              onChange={() => setBulkMode(true)}
                              className="accent-blue-600"
                            />
                            <span className="text-sm">Un PDF par personne</span>
                          </label>
                        </div>
                        <Button
                          onClick={handleBulkGenerate}
                          disabled={importLoading}
                          className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                        >
                          {importLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Download className="h-4 w-4 mr-2" />
                          )}
                          Générer {importData.length} PDF
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* HISTORY TAB */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <History className="h-5 w-5" />
                      Historique des invitations
                    </CardTitle>
                    <CardDescription>{history.length} invitation(s) générée(s)</CardDescription>
                  </div>
                  <div className="relative w-full sm:w-72">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input
                      placeholder="Rechercher par nom ou passeport..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredHistory.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">Aucune invitation dans l&apos;historique</p>
                    <p className="text-sm mt-1">Les invitations générées apparaîtront ici</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[500px]">
                    <div className="space-y-3">
                      {filteredHistory.map((record) => (
                        <div
                          key={record.id}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-4 min-w-0 flex-1">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${record.template === 'houacine' ? 'bg-red-500' : 'bg-blue-500'}`} />
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate">
                                {record.firstName} {record.lastName}
                              </div>
                              <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                                <span>Passeport: {record.passportNumber}</span>
                                <span className="hidden sm:inline">|</span>
                                <span>{record.arrivalDate} → {record.departureDate}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button variant="ghost" size="icon" onClick={() => handleRedownload(record)} title="Télécharger">
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDuplicate(record)} title="Dupliquer">
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteHistory(record.id)} title="Supprimer">
                              <Trash2 className="h-4 w-4 text-red-400" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Aperçu de l&apos;invitation
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 px-6 pb-6 overflow-hidden" style={{ height: 'calc(100% - 70px)' }}>
            {previewHtml && (
              <iframe
                srcDoc={previewHtml}
                className="w-full h-full border rounded-lg"
                title="Aperçu invitation"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="border-t bg-white mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 text-center text-xs text-gray-400">
          Générateur d&apos;invitations Chine —佛山市乐织外贸服务有限公司
        </div>
      </footer>
    </div>
  )
}
