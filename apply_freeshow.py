import sys
import re

def process_main(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Interface
    content = content.replace(
        '  proPresenterPort: string;',
        '  proPresenterPort: string;\n  freeShowEnabled: boolean;\n  freeShowIp: string;\n  freeShowPort: string;'
    )

    # 2. Initial state
    content = content.replace(
        'proPresenterPort: "20562",',
        'proPresenterPort: "20562",\n    freeShowEnabled: false,\n    freeShowIp: "127.0.0.1",\n    freeShowPort: "5505",'
    )

    # 3. API Statuses
    content = content.replace(
        "vmix: 'offline'",
        "vmix: 'offline', freeShow: 'offline'"
    )

    # 4. Trigger Local API (Push)
    pushCode = """        if (data.freeShow && data.freeShow.enabled) {
          fetch(`http://${data.freeShow.ip}:${data.freeShow.port}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'set_plain_text', data: { id: 'Default', value: data.content } })
          }).catch(e => console.error('[Bridge] FreeShow Error:', e.message));
        }"""
        
    content = re.sub(
        r"(if \(data\.vmix\.enabled\) \{[\s\S]*?console\.log\('\[Bridge\] vMix push sent'\);\n\s*\})",
        lambda m: m.group(1) + "\n" + pushCode,
        content
    )

    # 5. Trigger Local API (Clear)
    clearCode = """        if (data.freeShow && data.freeShow.enabled) {
          fetch(`http://${data.freeShow.ip}:${data.freeShow.port}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'clear_slide' })
          }).catch(e => console.error('[Bridge] FreeShow Error:', e.message));
        }"""
        
    content = re.sub(
        r"(if \(data\.proPresenter\.enabled\) \{[\s\S]*?console\.error\('\[Bridge\] ProPresenter Error:', e\.message\)\);\n\s*\})",
        lambda m: m.group(1) + "\n" + clearCode,
        content
    )

    # 6. UI
    uiCode = """            <div className="setting-item" style={{ marginBottom: "15px", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "15px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", color: "#60a5fa" }}>
                <input type="checkbox" checked={graphicsSettings.freeShowEnabled} onChange={(e) => setGraphicsSettings({ ...graphicsSettings, freeShowEnabled: e.target.checked })} />
                FreeShow Connection
                <span title={`API Status: ${apiStatuses.freeShow}`} style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: apiStatuses.freeShow === 'online' ? '#22c55e' : '#ef4444', display: 'inline-block', marginLeft: 'auto' }}></span>
              </label>
              {graphicsSettings.freeShowEnabled && (
                <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                  <input type="text" placeholder="IP Address" value={graphicsSettings.freeShowIp} onChange={(e) => setGraphicsSettings({ ...graphicsSettings, freeShowIp: e.target.value })} />
                  <input type="text" placeholder="Port" style={{ width: "70px" }} value={graphicsSettings.freeShowPort} onChange={(e) => setGraphicsSettings({ ...graphicsSettings, freeShowPort: e.target.value })} />
                </div>
              )}
            </div>\n"""
            
    content = re.sub(
        r'(<div className="setting-item"[^>]*>\s*<label[^>]*>\s*<input type="checkbox" checked=\{graphicsSettings\.proPresenterEnabled\})',
        lambda m: uiCode + m.group(1),
        content
    )

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

def process_sub(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    pushCode = """        if (data.freeShow && data.freeShow.enabled) {
          fetch(`http://${data.freeShow.ip}:${data.freeShow.port}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'set_plain_text', data: { id: 'Default', value: data.content } })
          }).catch(e => console.error('[Bridge] FreeShow Error:', e.message));
        }"""
        
    content = re.sub(
        r"(if \(data\.vmix\.enabled\) \{[\s\S]*?console\.log\('\[Bridge\] vMix push sent'\);\n\s*\})",
        lambda m: m.group(1) + "\n" + pushCode,
        content
    )

    clearCode = """        if (data.freeShow && data.freeShow.enabled) {
          fetch(`http://${data.freeShow.ip}:${data.freeShow.port}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'clear_slide' })
          }).catch(e => console.error('[Bridge] FreeShow Error:', e.message));
        }"""
        
    content = re.sub(
        r"(if \(data\.proPresenter\.enabled\) \{[\s\S]*?console\.error\('\[Bridge\] ProPresenter Error:', e\.message\)\);\n\s*\})",
        lambda m: m.group(1) + "\n" + clearCode,
        content
    )

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

def process_backend(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    content = content.replace(
        'proPresenter: { enabled: settings.proPresenterEnabled, ip: settings.proPresenterIp, port: settings.proPresenterPort }',
        'proPresenter: { enabled: settings.proPresenterEnabled, ip: settings.proPresenterIp, port: settings.proPresenterPort },\n      freeShow: { enabled: settings.freeShowEnabled, ip: settings.freeShowIp, port: settings.freeShowPort }'
    )
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

process_main('frontend/src/app/page.tsx')
process_sub('frontend/src/app/lyrics/page.tsx')
process_sub('frontend/src/app/bible/page.tsx')
process_backend('backend/src/index.ts')
print("Done processing files")
