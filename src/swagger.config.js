export default {
  openapi: '3.0.0',
  info: {
    title: 'EFG NSU Portal API',
    version: '1.0.0',
    description: 'Zentrales Portal für WhatsApp-Automatisierung und Dienstplanung der EFG NSU',
    contact: {
      name: 'API Support'
    }
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Development Server'
    }
  ],
  tags: [
    {
      name: 'WhatsApp',
      description: 'WhatsApp API Endpoints'
    }
  ],
  paths: {
    '/api/whatsapp/qr': {
      get: {
        tags: ['WhatsApp'],
        summary: 'QR-Code abrufen',
        description: 'Gibt den QR-Code zurück, um das WhatsApp-Gerät zu registrieren',
        responses: {
          200: {
            description: 'QR-Code erfolgreich abgerufen',
            content: {
              'text/html': {
                schema: {
                  type: 'string'
                }
              }
            }
          },
          404: {
            description: 'Kein QR-Code verfügbar (bereits verbunden)',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Response'
                }
              }
            }
          }
        }
      }
    },
    '/api/whatsapp/status': {
      get: {
        tags: ['WhatsApp'],
        summary: 'Verbindungsstatus abrufen',
        description: 'Gibt den aktuellen Verbindungsstatus von WhatsApp zurück',
        responses: {
          200: {
            description: 'Status erfolgreich abgerufen',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean'
                    },
                    data: {
                      type: 'object',
                      properties: {
                        connected: {
                          type: 'boolean'
                        },
                        hasQR: {
                          type: 'boolean'
                        },
                        user: {
                          type: 'object',
                          nullable: true
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/whatsapp/send-message': {
      post: {
        tags: ['WhatsApp'],
        summary: 'Nachricht senden',
        description: 'Sendet eine WhatsApp-Nachricht an eine Nummer',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SendMessage'
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Nachricht erfolgreich gesendet',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Response'
                }
              }
            }
          },
          400: {
            description: 'Ungültige Anfrage'
          },
          500: {
            description: 'Fehler beim Senden'
          }
        }
      }
    },
    '/api/whatsapp/send-poll': {
      post: {
        tags: ['WhatsApp'],
        summary: 'Umfrage senden',
        description: 'Sendet eine WhatsApp-Umfrage an eine Nummer',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SendPoll'
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Umfrage erfolgreich gesendet',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Response'
                }
              }
            }
          },
          400: {
            description: 'Ungültige Anfrage'
          },
          500: {
            description: 'Fehler beim Senden'
          }
        }
      }
    },
    '/api/whatsapp/logout': {
      post: {
        tags: ['WhatsApp'],
        summary: 'Logout und Gerät trennen',
        description: 'Trennt die Verbindung und löscht die Authentifizierung',
        responses: {
          200: {
            description: 'Erfolgreich ausgeloggt',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Response'
                }
              }
            }
          },
          500: {
            description: 'Fehler beim Logout'
          }
        }
      }
    }
  },
  components: {
    schemas: {
      SendMessage: {
        type: 'object',
        required: ['number', 'message'],
        properties: {
          number: {
            type: 'string',
            description: 'Empfängernummer (Format: 49123456789 ohne +)',
            example: '491234567890'
          },
          message: {
            type: 'string',
            description: 'Nachrichtentext',
            example: 'Hallo, das ist eine Testnachricht!'
          }
        }
      },
      SendPoll: {
        type: 'object',
        required: ['number', 'name', 'values'],
        properties: {
          number: {
            type: 'string',
            description: 'Empfängernummer (Format: 49123456789 ohne +)',
            example: '491234567890'
          },
          name: {
            type: 'string',
            description: 'Umfrage-Titel',
            example: 'Was ist deine Lieblingsfarbe?'
          },
          values: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Antwortmöglichkeiten',
            minItems: 2,
            example: ['Rot', 'Blau', 'Grün', 'Gelb']
          },
          selectableCount: {
            type: 'integer',
            description: 'Anzahl auswählbarer Optionen (Standard: 1)',
            example: 1,
            default: 1,
            minimum: 1
          }
        }
      },
      Response: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true
          },
          message: {
            type: 'string',
            example: 'Operation erfolgreich'
          },
          data: {
            type: 'object',
            nullable: true
          }
        }
      }
    }
  }
};