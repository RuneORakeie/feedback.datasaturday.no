-------------------------------------------------------------------------------
---
--- Add a presenter secret (guid) to the Feedback.Presenters table.
---
-------------------------------------------------------------------------------

IF (NOT EXISTS (SELECT NULL FROM sys.columns WHERE [object_id]=OBJECT_ID('Feedback.Presenters') AND [name]=N'Presenter_secret')) BEGIN;
    ALTER TABLE Feedback.Presenters ADD Presenter_secret    uniqueidentifier CONSTRAINT DF_Presenters_secret DEFAULT (NEWID()) NOT NULL;
    CREATE UNIQUE INDEX IX_Presenters_secret ON Feedback.Presenters (Presenter_secret);
END;

GO

-------------------------------------------------------------------------------
---
--- Extract a report on the event, containing details on sessions, presenters,
--- questions, answer options, as well as all the responses.
---
-------------------------------------------------------------------------------

CREATE OR ALTER PROCEDURE Feedback.Get_Presenter_Report
    @Event_ID               int,
    @Presenter_secret       uniqueidentifier
AS

SET NOCOUNT ON;

DECLARE @Presenter_ID int=(SELECT TOP (1) Presenter_ID
                           FROM Feedback.Presenters
                           WHERE Presenter_secret=@Presenter_secret);

IF (NOT EXISTS (SELECT NULL
                FROM Feedback.Sessions AS s
                INNER JOIN Feedback.Session_presenters AS sp ON s.Session_ID=sp.Session_ID
                WHERE s.Event_ID=@Event_ID
                  AND sp.Presented_by_ID=@Presenter_ID))
    THROW 50001, N'That doesn''t look right.', 1;

SELECT (
        SELECT e.[Name] AS [name],
               e.CSS AS css,
            (SELECT q.Question_ID AS questionId,
                    q.Display_order AS displayOrder,
                    q.Question AS [text],
                    q.[Type] AS [type],
                    q.Optimal_percent AS optimalValue,

                    (SELECT ao.Answer_option_ID AS optionId,
                            ao.Answer_ordinal AS ordinal,
                            ao.Percent_value AS [percent],
                            ao.Annotation AS annotation,
                            ao.CSS_classes AS css
                     FROM Feedback.Answer_options AS ao
                     WHERE ao.Question_ID=q.Question_ID
                     ORDER BY ao.Answer_ordinal
                     FOR JSON PATH) AS options

             FROM Feedback.Questions AS q
             WHERE q.Event_ID=@Event_ID
             ORDER BY q.Display_order
             FOR JSON PATH) AS questions,

            (SELECT s.Session_ID AS sessionId,
                    s.Sessionize_id AS sessionizeId,
                    s.Title AS title,

                    (SELECT sp.Presented_by_ID AS presenterId,
                            sp.Is_session_owner AS isOwner
                     FROM Feedback.Session_Presenters AS sp
                     WHERE sp.Session_ID=s.Session_ID
                       AND sp.Presented_by_ID=@Presenter_ID
                     FOR JSON PATH) AS presenters,

                    (SELECT q.Question_ID AS questionId,

                            (SELECT AVG(1.*ao.Percent_value)
                             FROM Feedback.Answer_options AS ao
                             INNER JOIN Feedback.Response_Answers AS ra ON ao.Answer_option_ID=ra.Answer_option_ID
                             INNER JOIN Feedback.Responses AS r ON ra.Response_ID=r.Response_ID
                             WHERE ao.Question_ID=q.Question_ID
                               AND r.Session_ID=s.Session_ID
                               AND ao.Percent_value IS NOT NULL) AS sessionAveragePercent,

                            (SELECT AVG(1.*ao.Percent_value)
                             FROM Feedback.Answer_options AS ao
                             INNER JOIN Feedback.Response_Answers AS ra ON ao.Answer_option_ID=ra.Answer_option_ID
                             INNER JOIN Feedback.Responses AS r ON ra.Response_ID=r.Response_ID
                             WHERE ao.Question_ID=q.Question_ID
                               AND ao.Percent_value IS NOT NULL) AS eventAveragePercent,

                            (SELECT COUNT(DISTINCT r.Response_ID)
                             FROM Feedback.Answer_options AS ao
                             INNER JOIN Feedback.Response_Answers AS ra ON ao.Answer_option_ID=ra.Answer_option_ID
                             INNER JOIN Feedback.Responses AS r ON ra.Response_ID=r.Response_ID
                             WHERE r.Session_ID=s.Session_ID
                               AND ao.Question_ID=q.Question_ID) AS sessionResponses,

                            (SELECT ao.Answer_option_ID AS optionId,
                                    COUNT((CASE WHEN r.Session_ID=x.Session_ID THEN ra.Response_ID END)) AS sessionResponses,
                                    1.*COUNT(ra.Response_ID)/NULLIF(SUM(COUNT(ra.Response_ID)) OVER (PARTITION BY ao.Question_ID), 0) AS eventResponses
                             FROM (VALUES (s.Session_ID)) AS x(Session_ID)
                             CROSS JOIN Feedback.Answer_options AS ao
                             LEFT JOIN Feedback.Response_Answers AS ra ON ao.Answer_option_ID=ra.Answer_option_ID
                             LEFT JOIN Feedback.Responses AS r ON ra.Response_ID=r.Response_ID
                             WHERE ao.Question_ID=q.Question_ID
                             GROUP BY ao.Question_ID, ao.Answer_option_ID
                             FOR JSON PATH) AS answers,

                            (SELECT rp.Question_ID AS questionId, 
                                    rp.Plaintext AS [text]
                             FROM Feedback.Responses AS r
                             INNER JOIN Feedback.Response_Plaintext AS rp ON rp.Response_ID=r.Response_ID
                             WHERE rp.Question_ID=q.Question_ID
                               AND r.Session_ID=s.Session_ID
                             FOR JSON PATH) AS textAnswers

                     FROM Feedback.Questions AS q
                     WHERE q.Event_ID=@Event_ID
                     FOR JSON PATH) AS questions

             FROM Feedback.[Sessions] AS s
             WHERE s.Event_ID=@Event_ID
               AND s.Session_ID IN (SELECT Session_ID FROM Feedback.Session_presenters WHERE Presented_by_ID=@Presenter_ID)
             FOR JSON PATH) AS [sessions]

        FROM Feedback.[Events] AS e
        WHERE e.Event_ID=@Event_ID
        FOR JSON AUTO, WITHOUT_ARRAY_WRAPPER) AS Report_blob;

GO

-------------------------------------------------------------------------------
---
--- Retrieve presenters for an event
---
-------------------------------------------------------------------------------

CREATE OR ALTER PROCEDURE Feedback.Admin_Event_Presenters
    @Event_secret       uniqueidentifier
AS

SET NOCOUNT ON;

SELECT (
    SELECT p.[Name] AS [name],
           e.Event_ID AS eventId,
           p.Presenter_secret AS presenterSecret
    FROM Feedback.[Events] AS e
    CROSS JOIN Feedback.Presenters AS p
    WHERE e.Event_secret=@Event_secret
      AND p.Presenter_ID IN (
        SELECT sp.Presented_by_ID
        FROM Feedback.[Sessions] AS s
        INNER JOIN Feedback.Session_presenters AS sp ON s.Session_ID=sp.Session_ID
        WHERE e.Event_ID=s.Event_ID)
    ORDER BY p.[Name]
    FOR JSON PATH
) AS Presenter_blob;

GO
