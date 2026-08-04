import { Request, Response } from "express";
import z from "zod";
import * as cookie from "cookie";

const ApprovedClientsSchema = z.array(z.string());

export enum ClientApproval {
  DENIED,
  APPROVED,
}

export interface ClientApprovalStore {
  getClientApproval(
    clientId: string,
    redirectUri: string,
  ): ClientApproval | undefined;
  setClientApproval(
    res: Response,
    clientId: string,
    redirectUri: string,
    approval: ClientApproval,
  ): void;
}

export type ClientApprovalStoreFactory = (
  request: Request,
) => ClientApprovalStore;

export class CookieClientApprovalStore implements ClientApprovalStore {
  constructor(
    private readonly approveClientsCookieName: string,
    private readonly deniedClientsCookieName: string,
    private readonly request: Request,
    private readonly onError?: (error: unknown) => void,
  ) {}

  private getClients(cookieName: string): string[] {
    const cookieHeader = this.request.headers.cookie;
    if (!cookieHeader) {
      return [];
    }

    try {
      const cookies = cookie.parse(cookieHeader);
      const consentCookie = cookies[cookieName];
      if (!consentCookie) {
        return [];
      }

      return ApprovedClientsSchema.parse(JSON.parse(consentCookie));
    } catch (error) {
      this.onError?.(error);
      return [];
    }
  }

  getClientApproval(clientId: string, redirectUri: string) {
    const approvedClients = this.getClients(this.approveClientsCookieName);
    const deniedClients = this.getClients(this.deniedClientsCookieName);

    const clientKey = `${clientId}:${redirectUri}`;
    if (approvedClients.includes(clientKey)) {
      return ClientApproval.APPROVED;
    }
    if (deniedClients.includes(clientKey)) {
      return ClientApproval.DENIED;
    }
    return undefined;
  }

  setClientApproval(
    res: Response,
    clientId: string,
    redirectUri: string,
    approval: ClientApproval,
  ) {
    const clientKey = `${clientId}:${redirectUri}`;
    if (approval === ClientApproval.APPROVED) {
      const approvedClients = this.getClients(this.approveClientsCookieName);
      if (approvedClients.includes(clientKey)) {
        return;
      }

      approvedClients.push(clientKey);
      res.cookie(
        this.approveClientsCookieName,
        JSON.stringify(approvedClients),
        { httpOnly: true, secure: true },
      );
    } else if (approval === ClientApproval.DENIED) {
      const deniedClients = this.getClients(this.deniedClientsCookieName);
      if (deniedClients.includes(clientKey)) {
        return;
      }

      deniedClients.push(clientKey);
      res.cookie(this.deniedClientsCookieName, JSON.stringify(deniedClients), {
        httpOnly: true,
        secure: true,
      });
    }
  }
}
