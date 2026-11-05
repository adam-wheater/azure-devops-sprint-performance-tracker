import * as React from "react";
import { BRAND } from "../brand";
import { Gate, IconAlert } from "./ui";

interface AccessDeniedProps {
  userEmail: string;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({ userEmail }) => (
  <Gate title="Access denied" icon={<IconAlert size={26} />}>
    <p className="ax-gate__body">
      Your account (<strong>{userEmail}</strong>) does not have permission to access {BRAND.name}.
    </p>
    <p className="ax-gate__body">Please contact an administrator to request access.</p>
  </Gate>
);
