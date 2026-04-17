const fs = require('fs');
const file = 'components/supplier-portal/SupplierDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. imports
content = content.replace(
  'X, Plus, Lock, Building2, User, Mail, Phone, Globe, Package, Leaf, ArrowLeft',
  'X, Plus, Lock, Building2, User, Mail, Phone, Globe, Package, Leaf, ArrowLeft, MapPin, Edit2'
);
content = content.replace(
  'import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";',
  'import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";\nimport { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";'
);

// 2. Interfaces
content = content.replace(
  /interface SupplierProfile \{[\s\S]*?\}/,
  `export type WebContactPhone = { number: string; ext?: string };
export type WebSupplierContact = { _id?: string; name: string; designation: string; emails: string[]; phones: WebContactPhone[]; address: string; };

interface SupplierProfile {
  name: string;
  portalEmail: string;
  portalPassword: string;
  manufacturingAddress: string;
  country: string;
  productsSupplied: string[];
  contacts: WebSupplierContact[];
}`
);

// 3. state init
content = content.replace(
  /const \[profile, setProfile\] = useState<SupplierProfile>\(\{[\s\S]*?\}\);/,
  `const [profile, setProfile] = useState<SupplierProfile>({
    name: '', portalEmail: '', portalPassword: '', manufacturingAddress: '',
    country: '', productsSupplied: [], contacts: []
  });`
);
content = content.replace(
  /const \[isProductPopoverOpen, setIsProductPopoverOpen\] = useState\(false\);/,
  `const [isProductPopoverOpen, setIsProductPopoverOpen] = useState(false);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [editingContactIndex, setEditingContactIndex] = useState<number | null>(null);
  const [contactForm, setContactForm] = useState<WebSupplierContact>({
    name: '', designation: '', emails: [''], phones: [{ number: '', ext: '' }], address: ''
  });`
);

// 4. API mapping
content = content.replace(
  /const p: SupplierProfile = \{[\s\S]*?\};\n          setProfile\(p\);/,
  `const p: SupplierProfile = {
            name: data.name || '',
            portalEmail: data.portalEmail || '',
            portalPassword: data.portalPassword || '',
            manufacturingAddress: data.manufacturingAddress || '',
            country: data.country || '',
            productsSupplied: data.productsSupplied || [],
            contacts: data.contacts || []
          };
          setProfile(p);`
);

// 5. saveProfile
content = content.replace(
  /body: JSON\.stringify\(\{[\s\S]*?productsSupplied: profile\.productsSupplied,\n        \}\),/,
  `body: JSON.stringify({
          name: profile.name,
          manufacturingAddress: profile.manufacturingAddress,
          country: profile.country,
          productsSupplied: profile.productsSupplied,
          contacts: profile.contacts,
        }),`
);

// 6. insert saveContact, removeContact, openAddContact, openEditContact before saveProducts
content = content.replace(
  /const saveProducts = async/,
  `const saveContactsData = async (newContacts: WebSupplierContact[]) => {
    try {
      await fetch(\`/api/admin/suppliers/\${supplierId}\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: newContacts }),
      });
      setOriginalProfile(prev => prev ? { ...prev, contacts: newContacts } : prev);
      toast.success("Contacts updated!");
    } catch {
      toast.error("Error updating contacts.");
    }
  };

  const submitContact = () => {
    if (!contactForm.name) return toast.error("Contact name is required");
    const cleanedEmails = contactForm.emails.filter(e => e.trim());
    const cleanedPhones = contactForm.phones.filter(p => p.number.trim());
    const newContact = { ...contactForm, emails: cleanedEmails, phones: cleanedPhones };
    
    let newContacts = [...profile.contacts];
    if (editingContactIndex !== null && editingContactIndex >= 0) {
      newContacts[editingContactIndex] = newContact;
    } else {
      newContacts.push(newContact);
    }
    setProfile(p => ({ ...p, contacts: newContacts }));
    saveContactsData(newContacts);
    setIsContactDialogOpen(false);
  };

  const removeContact = (index: number) => {
    const newContacts = profile.contacts.filter((_, i) => i !== index);
    setProfile(p => ({ ...p, contacts: newContacts }));
    saveContactsData(newContacts);
  };

  const openAddContact = () => {
    setEditingContactIndex(null);
    setContactForm({ name: '', designation: '', emails: [''], phones: [{ number: '', ext: '' }], address: '' });
    setIsContactDialogOpen(true);
  };

  const openEditContact = (index: number) => {
    setEditingContactIndex(index);
    const c = profile.contacts[index];
    setContactForm({ 
      ...c, 
      emails: c.emails.length > 0 ? c.emails : [''], 
      phones: c.phones.length > 0 ? c.phones : [{ number: '', ext: '' }] 
    });
    setIsContactDialogOpen(true);
  };

  const saveProducts = async`
);

fs.writeFileSync(file, content);
