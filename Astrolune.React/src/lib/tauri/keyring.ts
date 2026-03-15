import { invoke } from "./bridge"

export const getPassword = (service: string, key: string) =>
  invoke<string | null>("keyring_get_password", { service, key })

export const setPassword = (service: string, key: string, password: string) =>
  invoke<void>("keyring_set_password", { service, key, password })

export const deletePassword = (service: string, key: string) =>
  invoke<void>("keyring_delete_password", { service, key })
