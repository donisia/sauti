# SAUTI

### Publish Freely. Own Your Voice. Earn Directly.

SAUTI is an open-source decentralized publishing platform designed to give independent authors greater control over their work, digital identity, content distribution, and earnings.

Developed by **Team HerFreedom** for **Hack4Freedom Nairobi 2026**, SAUTI leverages **Nostr** for decentralized identity and publishing and **Bitcoin Lightning** for micropayments. The platform aims to help authors publish independently, reach readers, and receive direct support without relying entirely on traditional publishing intermediaries.

*Your work. Your identity. Your freedom.*

---

## The Problem

Independent authors, particularly emerging writers, face several challenges:

* **Limited publishing opportunities:** Traditional publishing can be difficult to access, especially for emerging and independent authors.
* **Delayed or limited earnings:** Restrictive royalty arrangements, delayed payments, and intermediaries can make it difficult for authors to earn fairly from their work.
* **Digital piracy:** E-books and digital publications can be copied and redistributed without the author's permission, affecting their ability to earn.
* **Censorship and platform dependency:** Centralized platforms may restrict content or accounts, limiting authors' control over their work and audience.
* **Limited ownership of identity:** Authors can become dependent on individual platforms to maintain their publishing presence and connect with readers.

These challenges make it difficult for independent authors to maintain control over their work, reach their audiences, and earn sustainably.

## Our Solution

SAUTI is being developed as a decentralized publishing platform that connects authors directly with readers while reducing reliance on centralized publishing services.

The platform combines:

* **Nostr:** Supports portable author identities and cryptographically signed publishing events.
* **Bitcoin Lightning:** Enables small, direct payments that can be used to support authors and unlock premium content.
* **Decentralized distribution:** Uses independent Nostr relays to reduce dependence on a single publishing platform.
* **Payment-based content access:** Allows authors to designate content as free or premium, with premium access linked to payment.

SAUTI aims to give authors greater control over how they publish, distribute, and monetize their work.

## Key Features

| Feature                  | Description                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| Decentralized Identity   | Allows authors to use Nostr identities for a portable publishing presence.                      |
| Independent Publishing   | Enables authors to create books, publish chapters, and manage their work.                       |
| Nostr Integration        | Supports signed publishing events and distribution through Nostr relays.                        |
| Free and Premium Content | Allows authors to decide which chapters are freely available and which require payment.         |
| Lightning Payments       | Enables readers to pay in satoshis to unlock premium chapters.                                  |
| Author Profiles          | Provides a public space for author information and published works.                             |
| Earnings Dashboard       | Intended to help authors monitor sales and Lightning earnings.                                  |
| Multi-relay Distribution | Aims to distribute publishing events across multiple relays, reducing dependence on one server. |
| Content Access Controls  | Restricts access to premium chapters through a payment-based unlocking system.                  |

*Features are at different stages of development. Some may be planned or in prototype form and may not yet be available in the current version.*

SAUTI does not make digital content impossible to copy. Instead, it focuses on improving author control, distribution, accessibility, and monetization.

## How It Works

1. **Connect:** An author connects a Nostr-compatible signer to establish their publishing identity.
2. **Publish:** The author creates a book and publishes its chapters.
3. **Set Access:** The author chooses which chapters are free and which are premium.
4. **Discover:** Readers explore independent authors and available publications.
5. **Unlock:** Readers can make Bitcoin Lightning payments to access premium chapters.
6. **Earn:** Authors receive payments for their work and, as the relevant functionality is implemented, can track their earnings.

## Technology Stack

| Component               | Technology                                 |
| ----------------------- | ------------------------------------------ |
| Backend                 | Python, Flask                              |
| Frontend                | HTML, CSS, JavaScript, Bootstrap 5, Jinja2 |
| Database                | PostgreSQL                                 |
| Decentralized Identity  | Nostr                                      |
| Publishing Protocol     | Nostr events and relays                    |
| Payments                | Bitcoin Lightning                          |
| Version Control         | Git and GitHub                             |
| Development Environment | Visual Studio Code                         |

*This represents the project's technology stack and intended architecture. The implementation of individual integrations is subject to development progress.*

## Project Status

**Status: Active Development**

SAUTI is being developed as a web-based decentralized publishing platform. The project is focused on building an accessible publishing experience and integrating decentralized identity, relay-based content distribution, and Bitcoin Lightning payments.

Some features and integrations remain under development or in prototype stages. The availability of individual capabilities may change as the project progresses.

## Roadmap

The following roadmap outlines the project's development goals:

* [ ] Complete author registration and Nostr signer integration
* [ ] Implement signed Nostr publishing events
* [ ] Integrate Nostr relays for content distribution
* [ ] Complete book and chapter management
* [ ] Implement PostgreSQL data persistence
* [ ] Integrate Lightning invoice generation and payment verification
* [ ] Enable premium chapter unlocking
* [ ] Develop an author earnings dashboard
* [ ] Improve content access controls
* [ ] Conduct functional and security testing
* [ ] Deploy the application

## Team HerFreedom

| Team Member    | GitHub                                                     |
| -------------- | ---------------------------------------------------------- |
| Mackel Mboya   | [@MboyaAkinyiMackel](https://github.com/MboyaAkinyiMackel) |
| Cherise Osambo | [@OsamboCherise](https://github.com/OsamboCherise)         |
| Precious Muemi | [@PreciousMuemi](https://github.com/PreciousMuemi)         |
| Fiona Gachuuri | [@FionaGachuuri](https://github.com/FionaGachuuri)         |
| Donisia Mwende | [@donisia](https://github.com/donisia)                     |
| Bailey         | GitHub profile not listed                                  |

## Getting Started

SAUTI is currently under active development. Installation and configuration instructions will be provided as the application's dependencies and setup process are finalized.

## Contributing

SAUTI is an open-source project, and contributions, suggestions, and feedback are welcome.

To contribute:

1. Fork the repository.
2. Create a branch for your changes.
3. Make and test your changes.
4. Submit a pull request describing your contribution.

## Our Vision

We envision a publishing ecosystem where independent authors have greater control over their digital identities, their work, and how they earn from it.

By combining decentralized technologies with accessible digital publishing, SAUTI aims to support a more open, independent, and author-centred publishing experience.

---

**Built by Team HerFreedom**
**Hack4Freedom Nairobi 2026**
