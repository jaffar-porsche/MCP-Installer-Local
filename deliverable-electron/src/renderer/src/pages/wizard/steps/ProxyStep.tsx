import { Wand2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import Button from '@renderer/components/Button';
import Card from '@renderer/components/Card';
import TextField from '@renderer/components/TextField';
import { useWizardStore } from '@renderer/store/wizard';

export default function ProxyStep() {
  const http = useWizardStore((s) => s.proxyHttp);
  const https = useWizardStore((s) => s.proxyHttps);
  const setProxy = useWizardStore((s) => s.setProxy);

  async function autoDetect() {
    const d = await window.api.proxy.detect();
    if (!d.http && !d.https) {
      toast.info('No proxy detected. Leave the fields empty if you don’t need one.');
      return;
    }
    setProxy(d.http ?? '', d.https ?? '');
    toast.success(`Filled from ${d.source}.`);
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => void autoDetect()}>
          <Wand2 className="h-4 w-4" />
          Auto-detect from Windows
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setProxy('', '')}>
          <XCircle className="h-4 w-4" />
          Clear (no proxy)
        </Button>
      </div>
      <div className="mt-3 space-y-1">
        <TextField
          label="HTTP proxy"
          value={http}
          placeholder="http://http-proxy.porsche.org:3133"
          onChange={(e) => setProxy(e.target.value, https)}
          hint="Leave blank to skip. Auto-detect fills this from Windows registry settings."
        />
        <TextField
          label="HTTPS proxy"
          value={https}
          placeholder="http://http-proxy.porsche.org:3133"
          onChange={(e) => setProxy(http, e.target.value)}
          hint="Usually the same as the HTTP proxy on Porsche networks."
        />
      </div>
    </Card>
  );
}
