import { relations } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const ts = (name: string) => integer(name, { mode: "timestamp_ms" });
const createdAt = () => ts("created_at").notNull().$defaultFn(() => new Date());

export type Education = { school: string; major: string; degree: string; years: string };
export type Experience = { company: string; title: string; years: string };

export const users = sqliteTable("users", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"), // scrypt "salt:hash"; null for system users
  isSeeker: integer("is_seeker", { mode: "boolean" }).notNull().default(true),
  isSpecialist: integer("is_specialist", { mode: "boolean" }).notNull().default(false),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  isPlatform: integer("is_platform", { mode: "boolean" }).notNull().default(false),
  locale: text("locale").notNull().default("ko"), // ko | en
  affiliation: text("affiliation"), // seeker: school / major / year, optional
  creditBalance: integer("credit_balance").notNull().default(0), // cache; only via ledger.postTx()
  strikes: integer("strikes").notNull().default(0),
  createdAt: createdAt(),
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(), // sha256(token); the raw token only ever lives in the cookie
    userId: text("user_id").notNull().references(() => users.id),
    createdAt: createdAt(),
    expiresAt: ts("expires_at").notNull(),
  },
  (t) => [index("sessions_user").on(t.userId), index("sessions_expires").on(t.expiresAt)],
);

export const specialistProfiles = sqliteTable("specialist_profiles", {
  userId: text("user_id").primaryKey().references(() => users.id),
  headline: text("headline").notNull(),
  bio: text("bio").notNull(),
  categories: text("categories", { mode: "json" }).$type<string[]>().notNull(),
  basePrice: integer("base_price").notNull(), // credits per 60-min session, set by admins (floor MIN_BASE_RATE)
  requestedRate: integer("requested_rate"), // what the specialist asked for during onboarding
  education: text("education", { mode: "json" }).$type<Education[]>().notNull(),
  experience: text("experience", { mode: "json" }).$type<Experience[]>().notNull(),
  resumePath: text("resume_path"),
  verification: text("verification").notNull().default("none"), // none | pending | verified | rejected
  verificationNote: text("verification_note"), // admin note shown to the specialist on rejection
  submittedAt: ts("submitted_at"), // when the profile was last submitted for review
  reviewCount: integer("review_count").notNull().default(0), // cached from visible reviews
  avgScore: real("avg_score").notNull().default(0),
  rankScore: real("rank_score").notNull().default(0),
});

export const availabilityRules = sqliteTable("availability_rules", {
  id: id(),
  specialistId: text("specialist_id").notNull().references(() => specialistProfiles.userId),
  dayOfWeek: integer("day_of_week").notNull(), // 0=Sun … 6=Sat, Seoul-local
  startMinute: integer("start_minute").notNull(),
  endMinute: integer("end_minute").notNull(),
});

export const bookings = sqliteTable(
  "bookings",
  {
    id: id(),
    seekerId: text("seeker_id").notNull().references(() => users.id),
    specialistId: text("specialist_id").notNull().references(() => users.id),
    category: text("category").notNull(),
    startAt: ts("start_at").notNull(),
    endAt: ts("end_at").notNull(),
    durationMin: integer("duration_min").notNull().default(60), // 30 | 60
    price: integer("price").notNull(), // dynamic price snapshot for this duration
    priceNote: text("price_note").notNull(),
    status: text("status").notNull().default("confirmed"), // confirmed | in_progress | completed | cancelled | disputed | refunded
    seekerNote: text("seeker_note"),
    completedAt: ts("completed_at"),
    settledAt: ts("settled_at"),
    createdAt: createdAt(),
  },
  (t) => [index("bookings_specialist_start").on(t.specialistId, t.startAt)],
);

export const messages = sqliteTable(
  "messages",
  {
    id: id(),
    bookingId: text("booking_id").notNull().references(() => bookings.id),
    senderId: text("sender_id").notNull().references(() => users.id),
    kind: text("kind").notNull().default("text"), // text | system
    body: text("body").notNull(),
    lang: text("lang").notNull().default("ko"), // detected ko | en
    translatedBody: text("translated_body"), // stub output, null if unmatched
    attachmentId: text("attachment_id"), // set when kind = "file"
    createdAt: createdAt(),
  },
  (t) => [index("messages_booking_created").on(t.bookingId, t.createdAt)],
);

export const attachments = sqliteTable(
  "attachments",
  {
    id: id(),
    bookingId: text("booking_id").notNull().references(() => bookings.id),
    uploaderId: text("uploader_id").notNull().references(() => users.id),
    fileName: text("file_name").notNull(),
    storedPath: text("stored_path").notNull(), // server-generated, relative to project root
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("attachments_booking").on(t.bookingId)],
);

export const reviews = sqliteTable(
  "reviews",
  {
    id: id(),
    bookingId: text("booking_id").notNull().unique().references(() => bookings.id),
    reviewerId: text("reviewer_id").notNull().references(() => users.id),
    specialistId: text("specialist_id").notNull().references(() => users.id),
    score: integer("score").notNull(), // 0..100
    body: text("body").notNull(),
    status: text("status").notNull().default("visible"), // visible | flagged | hidden
    createdAt: createdAt(),
  },
  (t) => [index("reviews_specialist_status").on(t.specialistId, t.status)],
);

export const reviewFlags = sqliteTable(
  "review_flags",
  {
    id: id(),
    reviewId: text("review_id").notNull().references(() => reviews.id),
    rule: text("rule").notNull(), // reciprocal_7d | booking_ring_14d | repeat_reviewer_30d | burst_high_24h | new_account | instant_empty
    detail: text("detail", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull().default("open"), // open | dismissed | confirmed
    createdAt: createdAt(),
    resolvedAt: ts("resolved_at"),
  },
  (t) => [uniqueIndex("review_flags_review_rule").on(t.reviewId, t.rule)],
);

export const posts = sqliteTable("posts", {
  id: id(),
  authorId: text("author_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  clickCount: integer("click_count").notNull().default(0),
  createdAt: createdAt(),
});

export const postClicks = sqliteTable(
  "post_clicks",
  {
    id: id(),
    postId: text("post_id").notNull().references(() => posts.id),
    viewerId: text("viewer_id").notNull().references(() => users.id),
    dayKey: text("day_key").notNull(), // Seoul date "2026-09-12"
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("post_clicks_unique_day").on(t.postId, t.viewerId, t.dayKey)],
);

export const creditTransactions = sqliteTable(
  "credit_transactions",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id),
    type: text("type").notNull(), // signup_grant | topup | booking_hold | booking_release | booking_refund | platform_fee | post_click | withdrawal
    amount: integer("amount").notNull(), // signed; negative = debit
    bookingId: text("booking_id"),
    postId: text("post_id"),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("credit_tx_user_created").on(t.userId, t.createdAt)],
);

export const disputes = sqliteTable("disputes", {
  id: id(),
  bookingId: text("booking_id").notNull().unique().references(() => bookings.id),
  openedById: text("opened_by_id").notNull().references(() => users.id),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("open"), // open | approved | rejected
  adminNote: text("admin_note"),
  createdAt: createdAt(),
  resolvedAt: ts("resolved_at"),
});

export const withdrawalRequests = sqliteTable("withdrawal_requests", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id),
  amount: integer("amount").notNull(),
  bankInfo: text("bank_info").notNull(), // mock
  status: text("status").notNull().default("pending"), // pending | paid | rejected
  createdAt: createdAt(),
});

export const notifications = sqliteTable(
  "notifications",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id),
    kind: text("kind").notNull(), // booking_created | session_soon | review_request | dispute_update | flag_update | verification | payout
    params: text("params", { mode: "json" }).$type<Record<string, string | number>>(),
    href: text("href"),
    readAt: ts("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_read").on(t.userId, t.readAt)],
);

// Relations for the relational query API (db.query.*.findMany({ with }))
export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(specialistProfiles, { fields: [users.id], references: [specialistProfiles.userId] }),
  seekerBookings: many(bookings, { relationName: "seekerBookings" }),
  specialistBookings: many(bookings, { relationName: "specialistBookings" }),
  transactions: many(creditTransactions),
  notifications: many(notifications),
  posts: many(posts),
}));

export const specialistProfilesRelations = relations(specialistProfiles, ({ one, many }) => ({
  user: one(users, { fields: [specialistProfiles.userId], references: [users.id] }),
  availability: many(availabilityRules),
}));

export const availabilityRulesRelations = relations(availabilityRules, ({ one }) => ({
  specialist: one(specialistProfiles, { fields: [availabilityRules.specialistId], references: [specialistProfiles.userId] }),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  seeker: one(users, { fields: [bookings.seekerId], references: [users.id], relationName: "seekerBookings" }),
  specialist: one(users, { fields: [bookings.specialistId], references: [users.id], relationName: "specialistBookings" }),
  messages: many(messages),
  review: one(reviews, { fields: [bookings.id], references: [reviews.bookingId] }),
  dispute: one(disputes, { fields: [bookings.id], references: [disputes.bookingId] }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  booking: one(bookings, { fields: [messages.bookingId], references: [bookings.id] }),
  sender: one(users, { fields: [messages.senderId], references: [users.id] }),
}));

export const reviewsRelations = relations(reviews, ({ one, many }) => ({
  booking: one(bookings, { fields: [reviews.bookingId], references: [bookings.id] }),
  reviewer: one(users, { fields: [reviews.reviewerId], references: [users.id] }),
  specialist: one(users, { fields: [reviews.specialistId], references: [users.id] }),
  flags: many(reviewFlags),
}));

export const reviewFlagsRelations = relations(reviewFlags, ({ one }) => ({
  review: one(reviews, { fields: [reviewFlags.reviewId], references: [reviews.id] }),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, { fields: [posts.authorId], references: [users.id] }),
  clicks: many(postClicks),
}));

export const postClicksRelations = relations(postClicks, ({ one }) => ({
  post: one(posts, { fields: [postClicks.postId], references: [posts.id] }),
  viewer: one(users, { fields: [postClicks.viewerId], references: [users.id] }),
}));

export const creditTransactionsRelations = relations(creditTransactions, ({ one }) => ({
  user: one(users, { fields: [creditTransactions.userId], references: [users.id] }),
}));

export const disputesRelations = relations(disputes, ({ one }) => ({
  booking: one(bookings, { fields: [disputes.bookingId], references: [bookings.id] }),
  openedBy: one(users, { fields: [disputes.openedById], references: [users.id] }),
}));

export const withdrawalRequestsRelations = relations(withdrawalRequests, ({ one }) => ({
  user: one(users, { fields: [withdrawalRequests.userId], references: [users.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
export type SpecialistProfile = typeof specialistProfiles.$inferSelect;
export type AvailabilityRule = typeof availabilityRules.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type ReviewFlag = typeof reviewFlags.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type Dispute = typeof disputes.$inferSelect;
export type WithdrawalRequest = typeof withdrawalRequests.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
