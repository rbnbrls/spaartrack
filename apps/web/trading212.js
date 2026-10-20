(() => {
  const $ = id => document.getElementById(id);
  const root = '/api/v1/broker/trading212';
  let initialLoad = true;
  let token = sessionStorage.getItem('spaartrack-broker-session') || '', timer, loading = false;
  const messages = {
    BROKER_LOGIN_INPUT: 'Gebruik een geldig e-mailadres en een wachtwoord van minimaal 12 tekens.',
    BROKER_LOGIN_FAILED: 'E-mailadres of wachtwoord klopt niet.',
    BROKER_REGISTRATION_FAILED: 'Account aanmaken is niet gelukt. Gebruik Inloggen als je al een account hebt.',
    BROKER_LOGIN_REQUIRED: 'Je sessie is verlopen. Log opnieuw in.', LOGIN_RATE_LIMIT: 'Te veel inlogpogingen. Probeer het over een minuut opnieuw.',
    BROKER_UNAVAILABLE: 'De koppeling is tijdelijk niet beschikbaar. Controleer de serverconfiguratie of probeer opnieuw.',
    TRADING212_HTTP_401: 'Trading 212 weigert de API key of secret. Controleer ook Live/Demo. Ontkoppel deze verbinding en voeg de juiste sleutels toe.',
    TRADING212_HTTP_403: 'Toegang geweigerd. Controleer de leesrechten en eventuele IP-beperking van je API key.',
    TRADING212_HTTP_429: 'Trading 212 heeft het verzoek begrensd. Wacht even en synchroniseer opnieuw.',
    TRADING212_NETWORK: 'Trading 212 is niet bereikbaar. Probeer het later opnieuw.',
    TRADING212_PAGINATION_LIMIT: 'De historie is te groot voor één synchronisatie. Er zijn geen onvolledige resultaten opgeslagen.',
    TRADING212_SCHEMA: 'Trading 212 geeft een onverwacht antwoord. De vorige succesvolle gegevens blijven behouden.',
    BROKER_SYNC_FAILED: 'Synchronisatie mislukt. Controleer de serverconfiguratie en probeer opnieuw.',
    SYNC_RATE_LIMIT: 'Wacht enkele seconden voor je opnieuw synchroniseert.',
    CONNECTION_REVOKED: 'Deze verbinding is ontkoppeld.'
  };
  function message(text) { $('trading212-message').textContent = text; }
  function signedIn(value) {
    $('trading212-login').hidden = value; $('trading212-workspace').hidden = !value;
    if (!value) { token = ''; sessionStorage.removeItem('spaartrack-broker-session'); clearTimeout(timer); $('trading212-connections').replaceChildren(); $('trading212-results').replaceChildren(); }
  }
  async function request(path, body, method) {
    const response = await fetch(path, { method: method || (body ? 'POST' : 'GET'),
      headers: {'content-type':'application/json', authorization:`Bearer ${token}`, 'x-trace-id':crypto.randomUUID(), 'x-correlation-id':crypto.randomUUID()},
      ...(body ? {body:JSON.stringify(body)} : {}) });
    const data = await response.json();
    if (!response.ok) { if (data.error === 'BROKER_LOGIN_REQUIRED') signedIn(false); throw new Error(messages[data.error] || 'De aanvraag is niet gelukt. Probeer opnieuw.'); }
    return data;
  }
  function node(tag, text, className) { const el=document.createElement(tag); el.textContent=text; if(className)el.className=className; return el; }
  function button(text, action, disabled=false) { const el=node('button',text,'btn'); el.type='button';el.disabled=disabled;el.addEventListener('click',async()=>{el.disabled=true;try{await action();}catch(error){message(error.message);}finally{el.disabled=disabled;}});return el; }
  const money = (value,currency) => typeof value==='number' ? new Intl.NumberFormat('nl-NL',{style:'currency',currency}).format(value) : '—';
  async function refresh() {
    if (!token || loading) return;
    loading=true;clearTimeout(timer);
    try {
      const data=await request(root); signedIn(true);
      const list=$('trading212-connections');list.replaceChildren();
      if(initialLoad){$('trading212-new').open=!data.connections.length;initialLoad=false;}
      if (!data.connections.length) list.append(node('p','Nog geen verbinding. Voeg je API key en secret toe.','subtle'));
      let busy=false;
      for (const connection of data.connections) {
        const meta=connection.provider_metadata,run=connection.last_run,revoked=connection.status==='REVOKED',active=['QUEUED','RUNNING'].includes(run?.status);
        busy ||= active;
        const card=node('article','','card');card.style.padding='18px';
        card.append(node('h3',connection.display_name),node('p',`${meta.environment==='live'?'Live':'Demo'} · ${meta.account_type==='INVEST'?'Invest':'Stocks ISA'} · ${revoked?'Ontkoppeld':active?'Synchroniseren…':connection.status==='HEALTHY'?'Verbonden':connection.status==='ERROR'?'Actie nodig':'Wacht op verificatie'}`));
        if(meta.summary)card.append(node('p',`Accountwaarde ${money(meta.summary.totalValue,meta.summary.currency)} · Beschikbaar ${money(meta.summary.cash?.availableToTrade,meta.summary.currency)}`));
        card.append(node('p',`Laatste succesvolle sync: ${connection.last_successful_sync_at?new Date(connection.last_successful_sync_at).toLocaleString('nl-NL'):'nog niet'}`,'subtle'));
        if(connection.last_error_code)card.append(node('p',messages[connection.last_error_code]||'Synchronisatie mislukt. Probeer opnieuw.','broker-error'));
        if(run?.status==='SUCCEEDED')card.append(node('p',`${run.diagnostics.positions} posities · ${run.diagnostics.orders} orderuitvoeringen · ${run.diagnostics.dividends} dividenden · ${run.diagnostics.transactions} geldmutaties. ${run.records_created} nieuw · ${run.records_updated} gewijzigd · ${run.records_duplicate} ongewijzigd.`,'subtle'));
        const actions=node('div','','toolbar');
        actions.append(button('Synchroniseren',async()=>{await request(`${root}/${connection.id}/sync`,{});message('Synchronisatie gestart. Je kunt deze pagina verlaten.');await refresh();},revoked||active));
        actions.append(button('Gegevens bekijken',async()=>{
          const result=await request(`${root}/${connection.id}/results`),target=$('trading212-results');target.replaceChildren(node('h3','Gesynchroniseerde brokerdata'),node('p','Controleer deze activiteiten voordat ze in je portfolio worden verwerkt. Ze wijzigen je portfolio nog niet.','subtle'));
          const list=node('div');list.style.cssText='max-height:260px;overflow:auto';
          for(const item of result.items){const d=item.payload_json;const label=d.instrument?.name||d.instrument?.ticker||d.order?.instrument?.ticker||d.type||d.kind;const detail=node('details');detail.append(node('summary',`${label} · ${item.item_type==='NEW'?'Nieuw':item.item_type==='UPDATED'?'Gewijzigd':'Ongewijzigd'}`));
            const fields=node('dl');fields.style.cssText='display:grid;grid-template-columns:120px 1fr;gap:8px;font-size:.8rem';
            for(const [name,value] of [['Soort',({position:'Positie',order:'Orderuitvoering',dividend:'Dividend',transaction:'Geldmutatie'})[d.kind]],['Datum',d.fill?.filledAt||d.paidOn||d.dateTime||d.createdAt],['Aantal',d.quantity??d.fill?.quantity],['Koers',d.currentPrice??d.fill?.price],['Bedrag',d.amount??d.walletImpact?.currentValue??d.fill?.walletImpact?.netValue],['Valuta',d.currency||d.walletImpact?.currency||d.fill?.walletImpact?.currency||d.instrument?.currency]]){
              if(value!==undefined&&value!==null){fields.append(node('dt',name),node('dd',String(value)));}
            }
            detail.append(fields);list.append(detail);}
          if(!result.items.length)list.append(node('p','Nog geen gegevens beschikbaar.'));
          target.append(list,node('p','Toont maximaal 200 records. De volledige opgehaalde historie blijft opgeslagen.','subtle'));
        }));
        actions.append(button('Ontkoppelen',async()=>{await request(`${root}/${connection.id}/revoke`,{});message('Ontkoppeld: opgeslagen API-sleutels zijn verwijderd. Trek de key ook in bij Trading 212 als je deze nergens anders gebruikt.');await refresh();},revoked));
        card.append(actions);list.append(card);
      }
      if(!busy && /gestart|gecontroleerd/.test($('trading212-message').textContent)) message('Synchronisatie afgerond. Bekijk hieronder de status en je gegevens.');
      if(busy) timer=setTimeout(()=>refresh().catch(error=>message(error.message)),2500);
    } finally { loading=false; }
  }
  $('trading212-login').addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget;const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
    const body={email:$('trading212-email').value,password:$('trading212-password').value};$('trading212-password').value='';
    try {const data=await request(`/api/v1/broker/${event.submitter.value}`,body);token=data.token;sessionStorage.setItem('spaartrack-broker-session',token);signedIn(true);message('Ingelogd. Je kunt je Trading 212-account koppelen.');await refresh();}
    catch(error){message(error.message);}finally{buttons.forEach(b=>b.disabled=false);}
  });
  $('trading212-connect').addEventListener('submit',async event=>{
    event.preventDefault();const button=event.currentTarget.querySelector('button[type="submit"]');button.disabled=true;
    const body={display_name:$('trading212-name').value,environment:$('trading212-environment').value,account_type:$('trading212-account-type').value,api_key:$('trading212-api-key').value,api_secret:$('trading212-api-secret').value};
    $('trading212-api-key').value='';$('trading212-api-secret').value='';
    try{await request(root,body);$('trading212-new').open=false;message('Verbinding opgeslagen. Trading 212 wordt nu gecontroleerd en gesynchroniseerd.');await refresh();}catch(error){message(error.message);}finally{button.disabled=false;}
  });
  $('trading212-refresh').addEventListener('click',()=>refresh().catch(error=>message(error.message)));
  $('trading212-logout').addEventListener('click',async()=>{try{await request('/api/v1/broker/logout',{});signedIn(false);initialLoad=true;message('Je bent uitgelogd.');}catch(error){message(error.message);}});
  if(token){message('Je verbindingen worden geladen…');refresh().then(()=>message('Je verbindingen zijn bijgewerkt.')).catch(error=>message(error.message));}
})();
