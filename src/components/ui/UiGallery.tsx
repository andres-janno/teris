// src/components/ui/UiGallery.tsx — kõigi ühiste komponentide näidised (aadress /ui, ainult admin).
// Uue vaate tegemisel vali siit; kui vajalikku pole, lisa ui/ komponent või variant, mitte vaate-klass.
import React, { useEffect, useState } from 'react';
import { Moon, Pencil, Plus, Sun, Trash2 } from 'lucide-react';
import {
  Badge, Button, Card, Checkbox, ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger,
  Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTrigger, DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Field, Input, Panel, Popover,
  PopoverContent, PopoverTrigger, RadioGroup, RadioGroupItem, Select, Switch, Table, TableBody, TableCell, TableFooter,
  TableEmpty, TableHead, TableHeader, TableRow, Tabs, TabsContent, TabsList, TabsTrigger, Textarea, Tooltip,
} from './index';
import { DateInput } from '../DateInput';
import { FilterSelect } from '../FilterSelect';
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
  const [checked, setChecked] = useState(true);
  const [on, setOn] = useState(false);
  const [date, setDate] = useState('');
  const [filterValue, setFilterValue] = useState('');

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
          <Button size="icon" aria-label="Muuda"><Pencil size={16} /></Button>
          <Button variant="ghost" size="icon-sm" aria-label="Kustuta"><Trash2 size={14} /></Button>
          <Button variant="danger-ghost" size="icon-sm" aria-label="Kustuta"><Trash2 size={14} /></Button>
          <Button variant="ghost" size="icon-xs" aria-label="Muuda"><Pencil size={12} /></Button>
          <Button variant="primary" disabled>Keelatud</Button>
        </Section>

        <Section title="Märgid">
          <Badge tone="success">Tehtud</Badge>
          <Badge tone="info">Plaanis</Badge>
          <Badge tone="warning">Kontrolli</Badge>
          <Badge tone="danger">Viga</Badge>
          <Badge tone="accent">PRIA</Badge>
          <Badge>Mustand</Badge>
        </Section>

        <Section title="Sakid">
          <Tabs defaultValue="a">
            <TabsList><TabsTrigger value="a">Ülevaade</TabsTrigger><TabsTrigger value="b">Tööd</TabsTrigger><TabsTrigger value="c">Kulud</TabsTrigger></TabsList>
            <TabsContent value="a" className="pt-3 text-sm">Ülevaate sisu</TabsContent>
            <TabsContent value="b" className="pt-3 text-sm">Tööde sisu</TabsContent>
            <TabsContent value="c" className="pt-3 text-sm">Kulude sisu</TabsContent>
          </Tabs>
          <Tabs defaultValue="ha" variant="segmented">
            <TabsList><TabsTrigger value="ha">ha</TabsTrigger><TabsTrigger value="t">t</TabsTrigger><TabsTrigger value="eur">€</TabsTrigger></TabsList>
          </Tabs>
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
            <DropdownMenuTrigger asChild><Button>Rippmenüü</Button></DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Põld</DropdownMenuLabel>
              <DropdownMenuItem><Pencil size={14} />Muuda</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem danger><Trash2 size={14} />Kustuta</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <Card className="px-4 py-3 text-sm">Paremklõps siin</Card>
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
      </div>
    </div>
  );
};
