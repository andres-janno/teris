// src/components/ui/UiGallery.tsx — kõigi ühiste komponentide näidised (aadress /ui, ainult admin).
// Uue vaate tegemisel vali siit; kui vajalikku pole, lisa ui/ komponent või variant, mitte vaate-klass.
import React, { useEffect, useState } from 'react';
import { Clock, Inbox, Lock, LogOut, Moon, Pencil, Play, Plus, RotateCcw, Radio, Search, Sun, Trash2, Copy, Eye, Layers, Tractor, Wrench } from 'lucide-react';
import {
  Alert, Badge, Button, Card, Dropzone, CardActions, CardButton, CardHeader, Checkbox, CheckboxField,
  Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuCheckboxItem, MenuItemText, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Field, FieldRow, FormGrid, Input, Popover,
  PopoverContent, PopoverTrigger, RadioField, RadioGroup, RadioGroupItem, Select, Table, TableBody, TableCell, TableFooter,
  TableEmpty, TableHead, TableHeader, TableRow, Tabs, TabsList, TabsTrigger, Textarea, ToggleGroup,
  ToggleGroupItem, Tooltip, FilterBar, FilterBarItem, EmptyState, DateInput, FilterSelect, FilterClear, NumberInput, SearchInput, HelpHintPopover, ChipButton, NavSwitch, NavSwitchItem, SectionTitle, StatTile, LegendItem, KeyValueRow, PageHeader, ProgressBar, IconBox,
} from './index';
import { exampleCount, GalleryPanel, UnusedVariants, UsageBadges, UsageExample, UsageLayout, UsageSummary } from './UiGalleryUsage';
import { confirmDialog } from '../ConfirmDialog';
import { LicenseBanner, SupportBanner } from '../LicenseBanner';
import { DEFAULT_VEHICLE_COLOR, FINANCE_COST_COLOR } from '../../lib/dataColors';
import type { AuthUser } from '../../types/auth';

// Kiibi arvu klass (nagu Külvikorras)
const CHIP_NUM = 'font-medium text-foreground';

// Litsentsi- ja tugivaate ribade näidiskasutaja (päris andmetes neid riba-olekuid tavaliselt pole)
const BANNER_USER: AuthUser = {
  id: 'demo', username: 'demo', displayName: 'Näidis Kasutaja', isAdmin: true, isFinanceManager: false, mustChangePassword: false,
  tenantName: 'Näidisettevõte OÜ', license: { readOnly: false, validUntil: '2026-12-31', expiresSoon: true, modules: [] },
};

// components = ühised komponendid, mille kasutussagedus märgitakse pealkirja kõrvale (nimed index.ts-ist).
const Section: React.FC<{ title: string; components?: string[]; children: React.ReactNode }> = ({ title, components, children }) => (
  <GalleryPanel
    title={components?.length ? <span className="flex flex-wrap items-center gap-x-3 gap-y-2">{title}<UsageBadges names={components} /></span> : title}
    bodyClassName="flex flex-wrap items-start gap-3"
  >
    {children}
  </GalleryPanel>
);

export const UiGallery: React.FC = () => {
  // Algteema sama võtme alt, mida App.tsx kasutab (agrimap_theme); siin seda ei kirjutata.
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return localStorage.getItem('agrimap_theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  const [crop, setCrop] = useState('');
  const [menuOps, setMenuOps] = useState<string[]>(['Mari']);
  const [checked, setChecked] = useState(true);
  const [emptyChoice, setEmptyChoice] = useState('');
  const [groupChoice, setGroupChoice] = useState('');
  const [tab, setTab] = useState('a');
  const [openDialog, setOpenDialog] = useState<'form' | 'xl' | 'menu' | null>(null);
  const [date, setDate] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const [num, setNum] = useState<number | null>(12.5);
  const [search, setSearch] = useState('');
  const [fsel, setFsel] = useState('b');
  const [selX, setSelX] = useState('a');
  const [inpX, setInpX] = useState('Kaasiku');
  const [dateX, setDateX] = useState('2026-11-15');
  const [year, setYear] = useState('2026');
  const [pickedCard, setPickedCard] = useState('a');
  const [chip, setChip] = useState('none');
  const [tenure, setTenure] = useState(false);
  const [nav, setNav] = useState('map');

  return (
    <div className="h-screen overflow-y-auto bg-background text-foreground">
      <UsageLayout>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Ühised komponendid</h1>
          <Button size="sm" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            {theme === 'dark' ? 'Hele teema' : 'Tume teema'}
          </Button>
        </div>

        <UsageSummary />

        <Section title="Nupud" components={['Button']}>
          <UsageExample as={Button} name="Button" props={{ variant: 'primary' }}><Plus size={14} />Lisa töö</UsageExample>
          <UsageExample as={Button} name="Button" props={{}}>Tühista</UsageExample>
          <UsageExample as={Button} name="Button" props={{ variant: 'ghost' }}>Rohkem</UsageExample>
          <UsageExample as={Button} name="Button" props={{ variant: 'danger' }}><Trash2 size={14} />Kustuta</UsageExample>
          <UsageExample as={Button} name="Button" props={{ variant: 'primary', size: 'sm' }}>Väike</UsageExample>
          <UsageExample as={Button} name="Button" props={{ size: 'sm' }}>Väike</UsageExample>
          <UsageExample as={Button} name="Button" props={{ variant: 'ghost', size: 'sm' }}><Plus size={14} />Lisa rida</UsageExample>
          <UsageExample as={Button} name="Button" props={{ variant: 'danger', size: 'sm' }}>Kustuta</UsageExample>
          <UsageExample as={Button} name="Button" props={{ variant: 'ghost', size: 'icon-sm', 'aria-label': 'Muuda', title: 'Muuda' }}><Pencil size={14} /></UsageExample>
          <UsageExample as={Button} name="Button" props={{ size: 'icon-sm', 'aria-label': 'Logi välja', title: 'Logi välja' }}><LogOut size={14} /></UsageExample>
          <UsageExample as={Button} name="Button" props={{ variant: 'danger-ghost', size: 'icon-sm', 'aria-label': 'Kustuta' }}><Trash2 size={14} /></UsageExample>
          <UsageExample as={Button} name="Button" props={{ variant: 'ghost', size: 'icon-xs', 'aria-label': 'Muuda' }}><Pencil size={12} /></UsageExample>
          <UsageExample as={Button} name="Button" props={{ variant: 'primary', size: 'icon-lg', title: 'Mängi' }}><Play size={18} /></UsageExample>
          <UsageExample as={Button} name="Button" props={{ size: 'xs' }}><RotateCcw size={11} /><span>Vaheta</span></UsageExample>
          <UsageExample as={Button} name="Button" props={{ size: 'xs', 'aria-pressed': true }}>Sim</UsageExample>
          <UsageExample as={Button} name="Button" props={{ variant: 'ghost', size: 'icon-xs', 'aria-pressed': true, title: 'Rada nähtav' }}><Eye size={12} /></UsageExample>
          <UsageExample as={Button} name="Button" props={{ variant: 'primary', disabled: true }}>Keelatud</UsageExample>
          <UsageExample as={Button} name="Button" props={{ variant: 'link', size: 'inline' }}>Lõigu sees: ava register</UsageExample>
          <UsageExample as={Button} name="Button" props={{ variant: 'plain', size: 'inline' }}>Kogu rea nupp (plain)</UsageExample>
        </Section>

        <Section title="Kiibid" components={['ChipButton']}>
          <UsageExample as={ChipButton} name="ChipButton" props={{ variant: 'tint', accent: 'var(--amber-500)', selected: chip === 'a', dimmed: chip !== 'none' && chip !== 'a', onClick: () => setChip(chip === 'a' ? 'none' : 'a') }}><span>Talinisu</span><strong className={CHIP_NUM}>120,50 ha</strong></UsageExample>
          <UsageExample as={ChipButton} name="ChipButton" props={{ variant: 'tint', accent: 'var(--blue-500)', selected: chip === 'b', dimmed: chip !== 'none' && chip !== 'b', onClick: () => setChip(chip === 'b' ? 'none' : 'b') }}><span>Suvioder</span><strong className={CHIP_NUM}>40,00 ha</strong></UsageExample>
          <UsageExample as={ChipButton} name="ChipButton" props={{ variant: 'outline', accent: 'var(--emerald-500)', selected: tenure, onClick: () => setTenure(!tenure) }}><span className="text-muted-foreground">Oma maa:</span><strong className={CHIP_NUM}>312 ha</strong></UsageExample>
        </Section>

        <Section title="Märgid" components={['Badge']}>
          <div className="flex w-full flex-wrap items-center gap-3">
            <UsageExample as={Badge} name="Badge" props={{}}>Tavaline</UsageExample>
            <UsageExample as={Badge} name="Badge" props={{ tone: 'success' }}>Aktiivne</UsageExample>
            <UsageExample as={Badge} name="Badge" props={{ tone: 'info' }}>Info</UsageExample>
            <UsageExample as={Badge} name="Badge" props={{ tone: 'warning' }}>Hoiatus</UsageExample>
            <UsageExample as={Badge} name="Badge" props={{ tone: 'danger' }}>Viga</UsageExample>
          </div>
          <div className="flex w-full flex-wrap items-center gap-3">
            <UsageExample as={Badge} name="Badge" props={{ tone: 'success', variant: 'solid' }}>Aktiivne</UsageExample>
            <UsageExample as={Badge} name="Badge" props={{ tone: 'warning', variant: 'solid' }}>3</UsageExample>
            <UsageExample as={Badge} name="Badge" props={{ tone: 'success', variant: 'outline', size: 'md', className: 'tabular-nums' }}>Nr 12</UsageExample>
            <UsageExample as={Badge} name="Badge" props={{ size: 'md' }}>Planeerimata</UsageExample>
            <UsageExample as={Badge} name="Badge" props={{ tone: 'success', size: 'md' }}>Suurus md</UsageExample>
          </div>
          <div className="flex w-full flex-wrap items-center gap-3">
            <UsageExample as={Badge} name="Badge" props={{ tone: 'success', dot: true }}>Punktiga</UsageExample>
            <UsageExample as={Badge} name="Badge" props={{ dot: '#e11d48' }}>Andmevärv</UsageExample>
            <UsageExample as={Badge} name="Badge" props={{ tone: 'info' }}><Clock size={12} />Ikooniga</UsageExample>
          </div>
        </Section>

        <Section title="Sakid" components={['Tabs', 'TabsList', 'TabsTrigger']}>
          <div>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="a">Ülevaade</TabsTrigger>
                <TabsTrigger value="b">Tööd <Badge tone="warning" variant="solid">3</Badge></TabsTrigger>
                <TabsTrigger value="c" disabled>Kulud</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="pt-3 text-sm">{tab === 'a' ? 'Ülevaate sisu' : tab === 'b' ? 'Tööde sisu' : 'Kulude sisu'}</div>
          </div>
          <Tabs defaultValue="ha" variant="segmented">
            <TabsList><TabsTrigger value="ha">ha</TabsTrigger><TabsTrigger value="t">t</TabsTrigger><TabsTrigger value="eur">€</TabsTrigger></TabsList>
          </Tabs>
        </Section>

        <Section title="Valikurida" components={['ToggleGroup', 'ToggleGroupItem']}>
          <ToggleGroup aria-label="Hooaasta" value={year} onValueChange={setYear}>
            <ToggleGroupItem value="2024" title="Hooaeg on lukus">2024<Lock size={10} /></ToggleGroupItem>
            <ToggleGroupItem value="2025">2025</ToggleGroupItem>
            <ToggleGroupItem value="2026">2026</ToggleGroupItem>
            <ToggleGroupItem value="2027" disabled>2027</ToggleGroupItem>
          </ToggleGroup>
        </Section>

        <Section title="Peamenüü (NavSwitch)" components={['NavSwitch', 'NavSwitchItem']}>
          <NavSwitch aria-label="Näidisvaated">
            {[['map', 'Kaart'], ['fields', 'Põllud'], ['works', 'Põllutööd']].map(([id, label]) => (
              <NavSwitchItem key={id} current={nav === id} onClick={() => setNav(id)}>
                <Eye size={15} />
                <span>{label}</span>
              </NavSwitchItem>
            ))}
          </NavSwitch>
        </Section>

        <Section title="Vormiväljad" components={['Field', 'FormGrid', 'FieldRow', 'Input', 'Textarea', 'Select', 'Checkbox', 'CheckboxField', 'RadioGroup', 'RadioGroupItem', 'RadioField']}>
          <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="Nimi" htmlFor="g-name" hint="Põllu nimi registris"><UsageExample as={Input} name="Input" className="w-full" props={{ id: 'g-name', placeholder: 'Nt Kaasiku' }} /></Field>
            <Field label="Kultuur" htmlFor="g-crop">
              <UsageExample as={Select} name="Select" className="w-full" props={{ id: 'g-crop', value: crop, onValueChange: setCrop, options: [{ value: 'wheat', label: 'Talinisu' }, { value: 'rapeseed', label: 'Taliraps' }, { value: 'barley', label: 'Suvioder' }] }} />
            </Field>
            <Field label="Pindala" htmlFor="g-area" error="Pindala peab olema positiivne"><Input id="g-area" aria-invalid defaultValue="-2" className="text-right" /></Field>
            <Field label="Märkus" htmlFor="g-note" className="md:col-span-3"><Textarea id="g-note" /></Field>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={checked} onCheckedChange={setChecked} />Arvesta PRIA-sse</label>
            <RadioGroup defaultValue="plan">
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="plan" />Plaan</label>
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="actual" />Tegelik</label>
            </RadioGroup>
            <Field label="Väike (sm, tabeli ridades)"><UsageExample as={Input} name="Input" className="w-full" props={{ size: 'sm', defaultValue: 'Kaasiku' }} /></Field>
            <Field label="Arv ühikuga"><Input numeric end="ha" defaultValue="12,50" /></Field>
            <Field label="Otsing ikooniga"><Input start={<Search size={14} />} placeholder="Otsi…" /></Field>
            <Field label="Kirjutuskaitstud"><Input readOnly value="12,50" /></Field>
            <Field label="Automaatselt kasvav" className="md:col-span-2"><Textarea autosize defaultValue="Kasvab sisu järgi" /></Field>
            <Field label="Select tühja valikuga">
              <Select value={emptyChoice} onValueChange={setEmptyChoice} options={[{ value: '', label: '— vali —' }, { value: 'a', label: 'Esimene' }, { value: 'b', label: 'Teine' }]} />
            </Field>
            <Field label="Select rühmadega">
              <Select
                value={groupChoice}
                onValueChange={setGroupChoice}
                options={[
                  { value: '', label: 'Kõik' },
                  { value: 'l1', label: 'Rõngu ait', group: 'Laod' },
                  { value: 'l2', label: 'Kuivati', group: 'Laod' },
                  { value: 'f1', label: 'Kaasiku', group: 'Põllud' },
                ]}
              />
            </Field>
            <Field label="Select sm">
              <UsageExample as={Select} name="Select" className="w-full" props={{ size: 'sm', value: crop, onValueChange: setCrop, options: [{ value: 'wheat', label: 'Talinisu' }, { value: 'rapeseed', label: 'Taliraps' }] }} />
            </Field>
            <CheckboxField label="Mitteaktiivne" hint="Ei näidata valikutes" checked={checked} onCheckedChange={setChecked} />
            <RadioGroup orientation="vertical" defaultValue="plan">
              <RadioField value="plan" label="Plaan" />
              <RadioField value="actual" label="Tegelik" />
            </RadioGroup>
            <FormGrid className="md:col-span-3">
              <Field label="Esimene"><Input /></Field>
              <Field label="Teine"><Input /></Field>
              <Field label="Üle rea" span="full"><FieldRow><Input /><Button>Nupp</Button></FieldRow></Field>
            </FormGrid>
          </div>
        </Section>

        <Section title="Tabel" components={['Table', 'TableHeader', 'TableBody', 'TableFooter', 'TableRow', 'TableHead', 'TableCell', 'TableEmpty']}>
          <Table>
            <TableHeader><TableRow><TableHead>Põld</TableHead><TableHead>Kultuur</TableHead><TableHead numeric>Pindala, ha</TableHead><TableHead>Olek</TableHead></TableRow></TableHeader>
            <TableBody>
              <TableRow><TableCell>Kaasiku</TableCell><TableCell>Talinisu</TableCell><TableCell numeric>12,40</TableCell><TableCell><Badge tone="success">Külvatud</Badge></TableCell></TableRow>
              <TableRow selected><TableCell>Männiku</TableCell><TableCell>Taliraps</TableCell><TableCell numeric>8,05</TableCell><TableCell><Badge tone="info">Plaanis</Badge></TableCell></TableRow>
              <TableRow><TableCell>Oja</TableCell><TableCell>Suvioder</TableCell><TableCell numeric>21,70</TableCell><TableCell><Badge tone="warning">Kontrolli</Badge></TableCell></TableRow>
            </TableBody>
            <TableFooter><TableRow><TableCell colSpan={2}>Kokku</TableCell><TableCell numeric>42,15</TableCell><TableCell /></TableRow></TableFooter>
          </Table>
          <Table scroll="md" bordered>
            <TableHeader>
              <TableRow>
                <TableHead sort="asc">Nimi</TableHead><TableHead numeric>Kogus, t</TableHead><TableHead actions>Tegevused</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow onClick={() => undefined}><TableCell>Klõpsatav rida</TableCell><TableCell numeric>12,40</TableCell>
                <TableCell actions><Button variant="ghost" size="icon-sm" aria-label="Muuda"><Pencil size={15} /></Button></TableCell></TableRow>
              <TableRow selected><TableCell>Valitud rida</TableCell><TableCell numeric>8,05</TableCell><TableCell actions /></TableRow>
              <TableRow tone="muted"><TableCell>Mitteaktiivne</TableCell><TableCell numeric>0,00</TableCell><TableCell actions /></TableRow>
              <TableRow tone="group"><TableCell colSpan={3}>Grupi vahepealkiri</TableCell></TableRow>
            </TableBody>
          </Table>
          <Table bordered><TableBody><TableEmpty colSpan={3}>Kirjeid pole</TableEmpty></TableBody></Table>
        </Section>

        <Section title="Kuupäev, arv, otsing ja filtrid" components={['DateInput', 'NumberInput', 'SearchInput', 'FilterSelect', 'FilterClear']}>
          <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="Kuupäev (md)" htmlFor="g-date"><DateInput id="g-date" value={date} onChange={setDate} /></Field>
            <Field label="Kuupäev (sm)" htmlFor="g-date-sm"><DateInput id="g-date-sm" size="sm" value={date} onChange={setDate} /></Field>
            <Field label="Kuupäev, vigane (sisesta „x“)" htmlFor="g-date-bad"><DateInput id="g-date-bad" value="" onChange={() => {}} /></Field>
            <Field label="Arv ühikuga (NumberInput end)" htmlFor="g-num"><UsageExample as={NumberInput} name="NumberInput" className="w-full" props={{ id: 'g-num', end: 'ha', value: num, onChange: setNum }} /></Field>
            <Field label="Arv (sm)" htmlFor="g-num-sm"><UsageExample as={NumberInput} name="NumberInput" className="w-full" props={{ id: 'g-num-sm', size: 'sm', value: num, onChange: setNum }} /></Field>
            <Field label="Otsing (SearchInput, X tühjendab)" htmlFor="g-search"><SearchInput aria-label="Otsing" placeholder="Otsi…" value={search} onChange={setSearch} /></Field>
            <Field label="Otsinguga valik rühmadega (FilterClear sees)">
              <FilterClear fill active={fsel !== ''} onClear={() => setFsel('')}>
                <FilterSelect fill value={fsel} onChange={setFsel} options={[{ value: '', label: 'Kõik põllud' }, { value: 'a', label: 'Kaasiku', group: 'Omad', color: '#16a34a' }, { value: 'b', label: 'Männiku', group: 'Omad', color: '#2563eb' }, { value: 'c', label: 'Põllu 12', group: 'Rendi' }]} />
              </FilterClear>
            </Field>
            <Field label="FilterClear ümber Select-i">
              <FilterClear fill active={selX !== ''} onClear={() => setSelX('')}>
                <Select value={selX} onValueChange={setSelX} options={[{ value: '', label: 'Kõik' }, { value: 'a', label: 'Esimene' }, { value: 'b', label: 'Teine' }]} />
              </FilterClear>
            </Field>
            <Field label="FilterClear ümber Input-i">
              <FilterClear fill active={inpX !== ''} onClear={() => setInpX('')}>
                <Input value={inpX} onChange={(e) => setInpX(e.target.value)} />
              </FilterClear>
            </Field>
            <Field label="FilterClear ümber DateInput-i">
              <FilterClear fill active={dateX !== ''} onClear={() => setDateX('')}>
                <DateInput value={dateX} onChange={setDateX} />
              </FilterClear>
            </Field>
            <Field label="Sisendi keelatud ja kirjutuskaitstud"><Input disabled value="Keelatud" onChange={() => {}} /></Field>
          </div>
        </Section>

        <Section title="Filtririba ja tühi olek" components={['FilterBar', 'FilterBarItem', 'EmptyState']}>
          <div className="grid w-full grid-cols-1 gap-3">
            <FilterBar actions={<Button size="sm">Värskenda</Button>}>
              <FilterBarItem>
                <FilterClear fill active={fsel !== ''} onClear={() => setFsel('')}>
                  <FilterSelect fill value={fsel} onChange={setFsel} options={[{ value: '', label: 'Kõik põllud' }, { value: 'a', label: 'Kaasiku' }, { value: 'b', label: 'Männiku' }]} />
                </FilterClear>
              </FilterBarItem>
              <FilterBarItem width="lg">
                <FilterClear fill active={selX !== ''} onClear={() => setSelX('')}>
                  <Select value={selX} onValueChange={setSelX} options={[{ value: '', label: 'Kõik' }, { value: 'a', label: 'Esimene' }, { value: 'b', label: 'Teine' }]} />
                </FilterClear>
              </FilterBarItem>
            </FilterBar>
            <EmptyState icon={<Inbox size={36} />} title="Kirjeid pole" description="Lisa esimene kirje." />
          </div>
        </Section>

        <Section title="Dialoog, menüüd, hüpikud" components={['Dialog', 'DialogContent', 'DropdownMenu', 'Popover', 'Tooltip']}>
          <Button variant="primary" onClick={() => setOpenDialog('form')}>Ava dialoog</Button>
          <Dialog open={openDialog === 'form'} onOpenChange={(o) => !o && setOpenDialog(null)}>
            <DialogContent>
              <DialogHeader title="Muuda põldu" description="Kaasiku · 12,40 ha" />
              <DialogBody>
                <Field label="Nimi" htmlFor="d-name"><Input id="d-name" defaultValue="Kaasiku" /></Field>
                <Field label="Kultuur" htmlFor="d-crop"><Select id="d-crop" value={crop} onValueChange={setCrop} options={[{ value: 'wheat', label: 'Talinisu' }, { value: 'rapeseed', label: 'Taliraps' }]} /></Field>
                <Field label="Kuupäev" htmlFor="d-date"><DateInput id="d-date" value={date} onChange={setDate} /></Field>
                <Field label="Otsingvalik" htmlFor="d-filter"><FilterSelect id="d-filter" fill value={filterValue} onChange={setFilterValue} options={[{ value: '', label: 'Kõik' }, { value: 'a', label: 'Kaasiku' }, { value: 'b', label: 'Männiku' }, { value: 'c', label: 'Põllu 12' }]} /></Field>
              </DialogBody>
              <DialogFooter><Button onClick={() => setOpenDialog(null)}>Tühista</Button><Button variant="primary" onClick={() => setOpenDialog(null)}>Salvesta</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <Button onClick={() => setOpenDialog('xl')}>Ava suur dialoog</Button>
          <Dialog open={openDialog === 'xl'} onOpenChange={(o) => !o && setOpenDialog(null)}>
            <DialogContent size="xl" fillHeight>
              <DialogHeader title="Suur dialoog" description="size=xl, fillHeight" />
              <DialogBody>Sisu täidab akna.</DialogBody>
              <DialogFooter><Button onClick={() => setOpenDialog(null)}>Sulge</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <Button onClick={() => void confirmDialog('Kas soovid kindlasti kustutada?')}>Kinnitus</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button id="gallery-menu-trigger">Rippmenüü</Button></DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Põld</DropdownMenuLabel>
              <DropdownMenuItem><Pencil />Muuda</DropdownMenuItem>
              <DropdownMenuItem><Copy />Kopeeri</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Operaatorid</DropdownMenuLabel>
              {['Mari', 'Jaan', 'Peeter'].map((n) => (
                <DropdownMenuCheckboxItem
                  key={n}
                  checked={menuOps.includes(n)}
                  onCheckedChange={(c) => setMenuOps((cur) => (c ? [...cur, n] : cur.filter((x) => x !== n)))}
                  onSelect={(e) => e.preventDefault()}
                >
                  {n}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="items-start"><Clock /><MenuItemText title="Külvamine" description="Töös · 12.11.2026 08:30" /></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem danger><Trash2 />Kustuta</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button>Pikk menüü</Button></DropdownMenuTrigger>
            <DropdownMenuContent>
              {Array.from({ length: 30 }, (_, i) => <DropdownMenuItem key={i}>Kirje {i + 1}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button id="gallery-icon-tip" variant="ghost" size="icon-sm" title="Muuda"><Pencil size={16} /></Button>
          <Button id="gallery-icon-tip-disabled" variant="ghost" size="icon-sm" title="Kustutamine pole võimalik" disabled><Trash2 size={16} /></Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button id="gallery-icon-menu" variant="ghost" size="icon-sm" title="Rohkem"><Copy size={16} /></Button></DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem><Pencil />Muuda</DropdownMenuItem>
              <DropdownMenuItem danger><Trash2 />Kustuta</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button id="gallery-dialog-menu" onClick={() => setOpenDialog('menu')}>Menüü dialoogis</Button>
          <Dialog open={openDialog === 'menu'} onOpenChange={(o) => !o && setOpenDialog(null)}>
            <DialogContent size="sm">
              <DialogHeader title="Menüü dialoogis" description="Esc sulgeb esmalt menüü, teine Esc akna" />
              <DialogBody>
                <div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button>Rippmenüü</Button></DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem><Pencil />Muuda</DropdownMenuItem>
                      <DropdownMenuItem danger><Trash2 />Kustuta</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </DialogBody>
              <DialogFooter><Button onClick={() => setOpenDialog(null)}>Sulge</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <Popover>
            <PopoverTrigger asChild><Button>Hüpik</Button></PopoverTrigger>
            <PopoverContent>Hüpiku sisu: filtrid, lisainfo või väike vorm.</PopoverContent>
          </Popover>
          <Tooltip content="Vihje tekst"><Button variant="ghost">Hõlju siin</Button></Tooltip>
        </Section>

        <Section title="Teated" components={['Alert']}>
          <div className="flex flex-col gap-2">
            <UsageExample as={Alert} name="Alert" props={{ tone: 'error' }}>Salvestamine ebaõnnestus: serveri viga.</UsageExample>
            <UsageExample as={Alert} name="Alert" props={{ tone: 'success' }}>Salvestatud.</UsageExample>
            <UsageExample as={Alert} name="Alert" props={{ tone: 'info' }}>See töö kuulub järgmise hooaja tsüklisse.</UsageExample>
            <UsageExample as={Alert} name="Alert" props={{ tone: 'warning' }}>Hooaeg on lukus.</UsageExample>
            <UsageExample as={Alert} name="Alert" props={{}}>Tavaline teade ilma toonita.</UsageExample>
            <UsageExample as={Alert} name="Alert" props={{ tone: 'error', size: 'sm' }}>Kannet ei õnnestunud salvestada.</UsageExample>
            <UsageExample as={Alert} name="Alert" props={{ size: 'sm' }}>Väike teade ilma toonita.</UsageExample>
            <UnusedVariants>
              {(['success', 'info', 'warning', 'neutral'] as const)
                .filter((tone) => exampleCount('Alert', { tone, size: 'sm' }) === 0)
                .map((tone) => (
                  <UsageExample key={tone} as={Alert} name="Alert" props={{ tone, size: 'sm' }}>Väike teade ({tone})</UsageExample>
                ))}
            </UnusedVariants>
          </div>
        </Section>

        <Section title="Litsentsiribad">
          <div className="flex w-full flex-col gap-2">
            <LicenseBanner user={BANNER_USER} />
            <LicenseBanner user={{ ...BANNER_USER, license: { ...BANNER_USER.license, readOnly: true, expiresSoon: false } }} />
            <LicenseBanner user={{ ...BANNER_USER, license: { ...BANNER_USER.license, readOnly: true, validUntil: null, expiresSoon: false } }} />
            <SupportBanner user={{ ...BANNER_USER, supportView: true, supportValidUntil: '2026-12-31T12:00:00.000Z' }} onLogout={() => undefined} />
          </div>
        </Section>

        <Section title="Failikast (Dropzone)" components={['Dropzone']}>
          <div className="flex w-full max-w-120 flex-col gap-2">
            <Dropzone>Lohista fail siia</Dropzone>
            <Dropzone hasFile>Fail valitud</Dropzone>
          </div>
        </Section>

        <Section title="Abi-ikoon (HelpHint)" components={['HelpHint', 'HelpHintPopover']}>
          <HelpHintPopover label="Põllu kood" html="<p>Põllu kood on <strong>PRIA põllu number</strong>. Hõlju või klõpsa ikoonil.</p>" />
          <HelpHintPopover label="Import" html="<p>Impordi põlluraamat CSV-failist.</p>" guideHref="#guide.fields#import" />
          <Button variant="secondary">
            Nupp koos ikooniga
            <HelpHintPopover inline label="Nupu sees" html="<p>Ikoon nupu sees (<code>inline</code>): klõps ei käivita nuppu.</p>" />
          </Button>
        </Section>

        <Section title="Kaardid" components={['Card', 'CardButton', 'CardHeader', 'CardActions']}>
          <Card className="w-72">
            <CardHeader align="start">
              <h3 className="m-0 text-base font-semibold">Kaart (surface)</h3>
              <CardActions>
                <Button variant="ghost" size="icon-sm" title="Muuda"><Pencil size={16} /></Button>
                <Button variant="danger-ghost" size="icon-sm" title="Kustuta"><Trash2 size={16} /></Button>
              </CardActions>
            </CardHeader>
            <p className="mt-2 text-sm text-muted-foreground">Tahke taust, 16px nurk, kaardi vari, polster md (16px).</p>
          </Card>
          <div className="w-80 rounded-md bg-muted p-4">
            <Card variant="floating" padding="sm" className="text-sm">
              Ujuv paneel (floating): kaardi peal, tugevam vari, polster sm (12px).
            </Card>
          </div>
          <Card className="w-96">
            <h3 className="m-0 text-base font-semibold">Plaadid kaardi sees (tile)</h3>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[['Põlde', '42'], ['Pindala', '312,40 ha'], ['Kulud', '18 240 €']].map(([label, value]) => (
                <Card key={label} variant="tile" padding="sm">
                  <div className="text-2xs uppercase text-muted-foreground">{label}</div>
                  <div className="num text-base font-semibold">{value}</div>
                </Card>
              ))}
            </div>
          </Card>
          <div className="flex w-72 flex-col gap-2">
            {['a', 'b'].map((id) => (
              <Card key={id} padding="sm" interactive selected={pickedCard === id} onClick={() => setPickedCard(id)}>
                Klõpsatav kaart {id.toUpperCase()} {pickedCard === id ? '(valitud)' : ''}
              </Card>
            ))}
            <CardButton variant="tile" padding="sm" selected={pickedCard === 'c'} onClick={() => setPickedCard('c')}>
              Plaat nupuna (CardButton tile)
            </CardButton>
          </div>
        </Section>
        <Section title="Jaotise pealkiri" components={['SectionTitle']}>
          <div className="w-72">
            <SectionTitle>Seadistused</SectionTitle>
            <SectionTitle ruled spaced>Vormi alajaotis (joonega)</SectionTitle>
          </div>
        </Section>
        <Section title="Näitaja plaat" components={['StatTile']}>
          <div className="grid w-full grid-cols-4 gap-3">
            <UsageExample as={StatTile} name="StatTile" props={{ label: 'Põllud kokku', value: <>12 <small>põldu</small></>, sub: <>Pindala: <strong>340,50 ha</strong></> }} />
            <UsageExample as={StatTile} name="StatTile" props={{ label: 'Kulud kokku', tone: 'cost', value: '48 200 €', sub: 'Keskmiselt: 140 € / ha' }} />
            <UsageExample as={StatTile} name="StatTile" props={{ label: 'Saagitulu kokku', tone: 'revenue', value: '61 900 €', note: 'Selgitus: tulu arvutatakse saagipartiide kaalust ja hinnast.' }} />
            <UsageExample as={StatTile} name="StatTile" props={{ label: 'Läbisõit', value: '—', empty: true }} />
          </div>
          <UnusedVariants>
            <UsageExample as={StatTile} name="StatTile" props={{ label: 'Tegevustulemus', tone: 'profit', value: '+13 700 €', sub: 'Tulemus: 40 € / ha' }} />
            <UsageExample as={StatTile} name="StatTile" props={{ label: 'Kahjum', tone: 'loss', value: '−2 100 €' }} />
          </UnusedVariants>
        </Section>
        <Section title="Rida silt: väärtus" components={['KeyValueRow']}>
          <div className="w-72">
            <KeyValueRow label="Kulud kokku:"><strong>48 200 €</strong></KeyValueRow>
            <KeyValueRow label="Puhastulemus:" className="font-semibold">+13 700 €</KeyValueRow>
          </div>
        </Section>
        <Section title="Legendi kirje" components={['LegendItem']}>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            <LegendItem color={FINANCE_COST_COLOR.equipment} label="Liikumine" />
            <LegendItem color={FINANCE_COST_COLOR.fuel} label="Seisuaeg süütega" value="3 min" />
            <LegendItem color={FINANCE_COST_COLOR.labor} label="Tööjõud:" value="48 200 €" note="(35%)" />
          </div>
        </Section>
        <Section title="Ikoonikast" components={['IconBox']}>
          <div className="flex items-center gap-3">
            <UsageExample as={IconBox} name="IconBox" props={{ tone: 'info' }}><Radio size={15} /></UsageExample>
            <UsageExample as={IconBox} name="IconBox" props={{ tone: 'success' }}><Tractor size={15} /></UsageExample>
            <UsageExample as={IconBox} name="IconBox" props={{ tone: 'warning' }}><Wrench size={15} /></UsageExample>
            <UsageExample as={IconBox} name="IconBox" props={{ size: 'md', style: { borderColor: DEFAULT_VEHICLE_COLOR } }}><Tractor size={20} /></UsageExample>
            <UsageExample as={IconBox} name="IconBox" props={{ size: 'lg' }}>🔧</UsageExample>
          </div>
        </Section>
        <Section title="Edenemisriba" components={['ProgressBar']}>
          <div className="flex w-72 flex-col gap-2">
            <ProgressBar value={0} aria-label="Tehtud 0%" />
            <ProgressBar value={45} aria-label="Tehtud 45%" />
            <ProgressBar value={100} aria-label="Tehtud 100%" />
          </div>
        </Section>
        <Section title="Vaate päis" components={['PageHeader']}>
          <div className="w-full">
            <PageHeader icon={<Layers />} title="Põllud" subtitle="Põldude üldandmed valitud hooajal" actions={<Button variant="primary">Lisa</Button>} />
          </div>
        </Section>
      </UsageLayout>
    </div>
  );
};
