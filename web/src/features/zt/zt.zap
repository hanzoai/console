# ZT — Zero Trust Network Schema
# Hanzo ZAP protocol definitions for ZT Edge Management API

struct ZtIdentity
  id Text
  name Text
  type IdentityType
  isOnline Bool
  isAdmin Bool
  roleAttributes List(Text)
  hasApiSession Bool
  hasEdgeRouterConnection Bool
  createdAt Text
  updatedAt Text

  struct IdentityType
    id Text
    name Text

struct ZtService
  id Text
  name Text
  encryptionRequired Bool
  terminatorStrategy Text
  roleAttributes List(Text)
  configs List(Text)
  createdAt Text
  updatedAt Text

struct ZtRouter
  id Text
  name Text
  isOnline Bool
  isVerified Bool
  fingerprint Text
  cost UInt32
  noTraversal Bool
  isTunnelerEnabled Bool
  roleAttributes List(Text)
  createdAt Text
  updatedAt Text

struct ZtServicePolicy
  id Text
  name Text
  type Text
  semantic Text
  identityRoles List(Text)
  serviceRoles List(Text)
  postureCheckRoles List(Text)
  createdAt Text
  updatedAt Text

struct ZtConfig
  id Text
  name Text
  configTypeId Text
  configTypeName Text
  data Text
  createdAt Text
  updatedAt Text

struct ZtTerminator
  id Text
  serviceId Text
  serviceName Text
  routerId Text
  routerName Text
  binding Text
  address Text
  cost UInt32
  precedence Text
  createdAt Text
  updatedAt Text

struct ZtSession
  id Text
  token Text
  identityId Text
  identityName Text
  serviceId Text
  serviceName Text
  type Text
  createdAt Text
  updatedAt Text

struct ZtDashboard
  identityCount UInt32
  serviceCount UInt32
  routerCount UInt32
  servicePolicyCount UInt32
  configCount UInt32
  sessionCount UInt32

struct ZtListResult
  data List(Data)
  totalCount UInt32

interface ZtService
  # Dashboard
  dashboard () -> (summary ZtDashboard)

  # Identities
  listIdentities (limit UInt32 = 100, offset UInt32 = 0, filter Text) -> (result ZtListResult)
  getIdentity (id Text) -> (identity ZtIdentity)
  createIdentity (name Text, type Text = "Device", isAdmin Bool = false, roleAttributes List(Text)) -> (identity ZtIdentity)
  updateIdentity (id Text, name Text, roleAttributes List(Text)) -> (identity ZtIdentity)
  deleteIdentity (id Text) -> (ok Bool)

  # Services
  listServices (limit UInt32 = 100, offset UInt32 = 0, filter Text) -> (result ZtListResult)
  getService (id Text) -> (service ZtService)
  createService (name Text, encryptionRequired Bool = true, roleAttributes List(Text), configs List(Text)) -> (service ZtService)
  deleteService (id Text) -> (ok Bool)

  # Routers
  listRouters (limit UInt32 = 100, offset UInt32 = 0, filter Text) -> (result ZtListResult)
  getRouter (id Text) -> (router ZtRouter)
  createRouter (name Text, cost UInt32 = 0, noTraversal Bool = false, isTunnelerEnabled Bool = true, roleAttributes List(Text)) -> (router ZtRouter)
  deleteRouter (id Text) -> (ok Bool)

  # Service Policies
  listServicePolicies (limit UInt32 = 100, offset UInt32 = 0, filter Text) -> (result ZtListResult)
  createServicePolicy (name Text, type Text, semantic Text = "AnyOf", identityRoles List(Text), serviceRoles List(Text), postureCheckRoles List(Text)) -> (policy ZtServicePolicy)
  deleteServicePolicy (id Text) -> (ok Bool)

  # Read-only listings
  listConfigs (limit UInt32 = 100, offset UInt32 = 0, filter Text) -> (result ZtListResult)
  listTerminators (limit UInt32 = 100, offset UInt32 = 0, filter Text) -> (result ZtListResult)
  listSessions (limit UInt32 = 100, offset UInt32 = 0, filter Text) -> (result ZtListResult)
