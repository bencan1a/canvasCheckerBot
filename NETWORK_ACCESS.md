# Network Access Guide

## Accessing Canvas RAG from Other Devices

By default, services are only accessible from localhost. To enable network access from phones, tablets, or other computers on your local network:

### Quick Start - Enable Network Access

```bash
# Start with network access enabled
NETWORK_ACCESS=true ./start-canvas-rag-system.sh local oobabooga
```

### Service Ports

Once running with network access, the following services are available:

| Service | Port | Local URL | Network URL |
|---------|------|-----------|-------------|
| Oobabooga WebUI | 7860 | http://localhost:7860 | http://[YOUR-IP]:7860 |
| Canvas RAG API | 3001 | http://localhost:3001 | http://[YOUR-IP]:3001 |
| Ollama API | 11434 | http://localhost:11434 | http://[YOUR-IP]:11434 |

### Finding Your IP Address

The script will display your IP when network access is enabled. You can also find it manually:

**Linux/Mac:**
```bash
hostname -I | awk '{print $1}'
# or
ip addr show | grep "inet " | grep -v 127.0.0.1
```

**Windows:**
```cmd
ipconfig | findstr /i "ipv4"
```

### Example Network URLs

If your computer's IP is `192.168.1.100`:
- Oobabooga: `http://192.168.1.100:7860`
- Canvas API: `http://192.168.1.100:3001`
- API Status: `http://192.168.1.100:3001/canvas/status`

### Mobile/Tablet Access

1. Ensure your device is on the same Wi-Fi network
2. Open browser on your device
3. Navigate to `http://[YOUR-IP]:7860`
4. You can now chat with your Canvas data from any device!

### Security Considerations

⚠️ **Warning:** Enabling network access exposes these services to your local network.

**Best Practices:**
- Only enable on trusted networks (home/office)
- Don't use on public Wi-Fi
- Consider firewall rules if needed
- Disable when not in use

### Firewall Configuration (Optional)

If services aren't accessible, you may need to allow ports through your firewall:

**Ubuntu/Debian:**
```bash
sudo ufw allow 7860/tcp  # Oobabooga
sudo ufw allow 3001/tcp  # Canvas API
```

**RHEL/Fedora:**
```bash
sudo firewall-cmd --add-port=7860/tcp --permanent
sudo firewall-cmd --add-port=3001/tcp --permanent
sudo firewall-cmd --reload
```

**macOS:**
The firewall should prompt you to allow access when you first start the services.

**Windows:**
Windows Defender may prompt to allow access. Accept for private networks only.

### Docker Network Access

For Docker deployments, network access is configured differently:

```yaml
# In docker-compose.yml, services already bind to 0.0.0.0
# Just ensure ports are mapped:
ports:
  - "0.0.0.0:7860:7860"  # Oobabooga
  - "0.0.0.0:3001:3001"  # Canvas API
```

### Troubleshooting Network Access

1. **Can't connect from other device:**
   - Verify both devices are on same network
   - Check IP address is correct
   - Ensure `NETWORK_ACCESS=true` was set
   - Check firewall settings

2. **Connection refused:**
   - Verify services are running: `ps aux | grep python`
   - Check ports: `netstat -tlnp | grep 7860`
   - Try accessing from local machine first

3. **Slow performance over network:**
   - This is normal for first request (model loading)
   - Consider using smaller models for better network performance
   - Ensure good Wi-Fi signal strength

### Advanced: Permanent Network Configuration

To always enable network access, add to your `.env` file:
```bash
NETWORK_ACCESS=true
```

Or modify the Oobabooga startup in the script to always include `--listen` flags.

### Remote Access (Beyond Local Network)

For access outside your local network, consider:
- SSH tunneling (secure, recommended)
- VPN to your home network
- Reverse proxy with authentication (advanced)
- **Never** expose directly to internet without authentication!