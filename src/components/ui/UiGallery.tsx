// src/components/ui/UiGallery.tsx — kõigi ühiste komponentide näidised (aadress /ui, ainult admin).
// Uue vaate tegemisel vali siit; kui vajalikku pole, lisa ui/ komponent või variant, mitte vaate-klass.
import React, { useEffect, useState } from 'react';
import { Clock, Lock, Moon, Pencil, Play, Plus, RotateCcw, Search, Sun, Trash2, Copy, Eye } from 'lucide-react';
import {
  Badge, Button, Card, CardActions, CardHeader, CardTitle, Checkbox, CheckboxField, ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger,
  Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTrigger, DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuCheckboxItem, MenuItemText, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Field, FieldRow, FormGrid, Input, Panel, Popover,
  PopoverContent, PopoverTrigger, RadioField, RadioGroup, RadioGroupItem, Select, Switch, Table, TableBody, TableCell, TableFooter,
  TableEmpty, TableHead, TableHeader, TableRow, Tabs, TabsContent, TabsList, TabsTrigger, Textarea, ToggleGroup,
  ToggleGroupItem, Tooltip, DateInput, FilterSelect, FilterClear, NumberInput, SearchInput,
} from './index';
import { confirmDialog } from '../ConfirmDialog';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Panel title={title} bodyClassName="flex flex-wrap items-start gap-3">{children}</Panel>
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
  const [on, setOn] = useState(false);
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

  return (
    <div className="h-screen overflow-y-auto bg-background text-foreground">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Ühised komponendid</h1>
          <Button size="sm" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            {theme === 'dark' ? 'Hele teema' : 'Tume teema'}
          </Button>
        </div>

        <Section title="Nupud">
          <Button variant="primary"><Plus size={14} />Lisa töö</Button>
          <Button>Tühista</Button>
          <Button variant="ghost">Rohkem</Button>
          <Button variant="danger"><Trash2 size={14} />Kustuta</Button>
          <Button variant="primary" size="sm">Väike</Button>
          <Button size="sm">Väike</Button>
          <Button size="icon-sm" aria-label="Muuda"><Pencil size={16} /></Button>
          <Button variant="ghost" size="icon-sm" aria-label="Kustuta"><Trash2 size={14} /></Button>
          <Button variant="danger-ghost" size="icon-sm" aria-label="Kustuta"><Trash2 size={14} /></Button>
          <Button variant="ghost" size="icon-xs" aria-label="Muuda"><Pencil size={12} /></Button>
          <Button variant="primary" size="icon-lg" title="Mängi"><Play size={18} /></Button>
          <Button size="xs"><RotateCcw size={11} /><span>Vaheta</span></Button>
          <Button size="xs" aria-pressed>Sim</Button>
          <Button variant="ghost" size="icon-xs" aria-pressed title="Rada nähtav"><Eye size={12} /></Button>
          <Button variant="primary" disabled>Keelatud</Button>
          <p className="text-sm">Lõigu sees: <Button variant="link" size="inline">ava register</Button></p>
        </Section>

        <Section title="Märgid">
          {(['success', 'info', 'warning', 'danger', 'accent', 'neutral'] as const).map((tone) => (
            <div key={tone} className="flex w-full flex-wrap items-center gap-3">
              <Badge tone={tone}>{tone}</Badge>
              <Badge tone={tone} variant="solid">{tone}</Badge>
              <Badge tone={tone} variant="outline">{tone}</Badge>
            </div>
          ))}
          <div className="flex w-full flex-wrap items-center gap-3">
            <Badge tone="success" size="md">Suurus md</Badge>
            <Badge tone="success" dot>Punktiga</Badge>
            <Badge dot="#e11d48">Andmevärv</Badge>
            <Badge tone="info"><Clock size={12} />Ikooniga</Badge>
            <Badge tone="danger" variant="outline">Puudus</Badge>
          </div>
        </Section>

        <Section title="Sakid">
          <Tabs defaultValue="a">
            <TabsList>
              <TabsTrigger value="a">Ülevaade</TabsTrigger>
              <TabsTrigger value="b">Tööd <Badge tone="warning" variant="solid">3</Badge></TabsTrigger>
              <TabsTrigger value="c" disabled>Kulud</TabsTrigger>
            </TabsList>
            <TabsContent value="a" className="pt-3 text-sm">Ülevaate sisu</TabsContent>
            <TabsContent value="b" className="pt-3 text-sm">Tööde sisu</TabsContent>
            <TabsContent value="c" className="pt-3 text-sm">Kulude sisu</TabsContent>
          </Tabs>
          <Tabs defaultValue="ha" variant="segmented">
            <TabsList><TabsTrigger value="ha">ha</TabsTrigger><TabsTrigger value="t">t</TabsTrigger><TabsTrigger value="eur">€</TabsTrigger></TabsList>
          </Tabs>
        </Section>

        <Section title="Valikurida">
          <ToggleGroup aria-label="Hooaasta" value={year} onValueChange={setYear}>
            <ToggleGroupItem value="2024" title="Hooaeg on lukus">2024<Lock size={10} /></ToggleGroupItem>
            <ToggleGroupItem value="2025">2025</ToggleGroupItem>
            <ToggleGroupItem value="2026">2026</ToggleGroupItem>
            <ToggleGroupItem value="2027" disabled>2027</ToggleGroupItem>
          </ToggleGroup>
        </Section>

        <Section title="Vormiväljad">
          <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="Nimi" htmlFor="g-name" hint="Põllu nimi registris"><Input id="g-name" placeholder="Nt Kaasiku" /></Field>
            <Field label="Kultuur" htmlFor="g-crop">
              <Select id="g-crop" value={crop} onValueChange={setCrop} options={[{ value: 'wheat', label: 'Talinisu' }, { value: 'rapeseed', label: 'Taliraps' }, { value: 'barley', label: 'Suvioder' }]} />
            </Field>
            <Field label="Pindala" htmlFor="g-area" error="Pindala peab olema positiivne"><Input id="g-area" aria-invalid defaultValue="-2" className="text-right" /></Field>
            <Field label="Märkus" htmlFor="g-note" className="md:col-span-3"><Textarea id="g-note" /></Field>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={checked} onCheckedChange={setChecked} />Arvesta PRIA-sse</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={on} onCheckedChange={setOn} />Saadab ka seisu ajal</label>
            <RadioGroup defaultValue="plan">
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="plan" />Plaan</label>
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="actual" />Tegelik</label>
            </RadioGroup>
            <Field label="Väike (sm, tabeli ridades)"><Input size="sm" defaultValue="Kaasiku" /></Field>
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
              <Select size="sm" value={crop} onValueChange={setCrop} options={[{ value: 'wheat', label: 'Talinisu' }, { value: 'rapeseed', label: 'Taliraps' }]} />
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

        <Section title="Tabel">
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

        <Section title="Kuupäev, arv, otsing ja filtrid">
          <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="Kuupäev (md)" htmlFor="g-date"><DateInput id="g-date" value={date} onChange={setDate} /></Field>
            <Field label="Kuupäev (sm)" htmlFor="g-date-sm"><DateInput id="g-date-sm" size="sm" value={date} onChange={setDate} /></Field>
            <Field label="Kuupäev, vigane (sisesta „x“)" htmlFor="g-date-bad"><DateInput id="g-date-bad" value="" onChange={() => {}} /></Field>
            <Field label="Arv ühikuga (NumberInput end)" htmlFor="g-num"><NumberInput id="g-num" end="ha" value={num} onChange={setNum} /></Field>
            <Field label="Arv (sm)" htmlFor="g-num-sm"><NumberInput id="g-num-sm" size="sm" value={num} onChange={setNum} /></Field>
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

        <Section title="Dialoog, menüüd, hüpikud">
          <Dialog>
            <DialogTrigger asChild><Button variant="primary">Ava dialoog</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader title="Muuda põldu" description="Kaasiku · 12,40 ha" />
              <DialogBody>
                <Field label="Nimi" htmlFor="d-name"><Input id="d-name" defaultValue="Kaasiku" /></Field>
                <Field label="Kultuur" htmlFor="d-crop"><Select id="d-crop" value={crop} onValueChange={setCrop} options={[{ value: 'wheat', label: 'Talinisu' }, { value: 'rapeseed', label: 'Taliraps' }]} /></Field>
                <Field label="Kuupäev" htmlFor="d-date"><DateInput id="d-date" value={date} onChange={setDate} /></Field>
                <Field label="Otsingvalik" htmlFor="d-filter"><FilterSelect id="d-filter" fill value={filterValue} onChange={setFilterValue} options={[{ value: '', label: 'Kõik' }, { value: 'a', label: 'Kaasiku' }, { value: 'b', label: 'Männiku' }, { value: 'c', label: 'Põllu 12' }]} /></Field>
              </DialogBody>
              <DialogFooter><Button>Tühista</Button><Button variant="primary">Salvesta</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog>
            <DialogTrigger asChild><Button>Ava suur dialoog</Button></DialogTrigger>
            <DialogContent size="xl" fillHeight>
              <DialogHeader title="Suur dialoog" description="size=xl, fillHeight" />
              <DialogBody>Sisu täidab akna.</DialogBody>
              <DialogFooter><Button>Sulge</Button></DialogFooter>
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
          <Button variant="filter" size="auto">Operaator: Mari</Button>
          <Button id="gallery-icon-tip" variant="ghost" size="icon-sm" title="Muuda"><Pencil size={16} /></Button>
          <Button id="gallery-icon-tip-disabled" variant="ghost" size="icon-sm" title="Kustutamine pole võimalik" disabled><Trash2 size={16} /></Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button id="gallery-icon-menu" variant="ghost" size="icon-sm" title="Rohkem"><Copy size={16} /></Button></DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem><Pencil />Muuda</DropdownMenuItem>
              <DropdownMenuItem danger><Trash2 />Kustuta</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Dialog>
            <DialogTrigger asChild><Button id="gallery-dialog-menu">Menüü dialoogis</Button></DialogTrigger>
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
              <DialogFooter><Button>Sulge</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <Card padding="sm" className="text-sm">Paremklõps siin</Card>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem>Ava põld</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem danger>Eemalda</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
          <Popover>
            <PopoverTrigger asChild><Button>Hüpik</Button></PopoverTrigger>
            <PopoverContent>Hüpiku sisu: filtrid, lisainfo või väike vorm.</PopoverContent>
          </Popover>
          <Tooltip content="Vihje tekst"><Button variant="ghost">Hõlju siin</Button></Tooltip>
        </Section>

        <Section title="Kaardid">
          <Card className="w-72">
            <CardHeader align="start">
              <CardTitle>Kaart (surface)</CardTitle>
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
            <CardTitle>Plaadid kaardi sees (tile)</CardTitle>
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
            <Card asChild variant="tile" padding="sm" interactive selected={pickedCard === 'c'}>
              <button type="button" onClick={() => setPickedCard('c')}>Plaat nupuna (asChild + button)</button>
            </Card>
          </div>
          <Panel title="Paneel" actions={<Button size="sm">Tegevus</Button>} className="w-72">Päisega paneel (Panel).</Panel>
        </Section>
      </div>
    </div>
  );
};
