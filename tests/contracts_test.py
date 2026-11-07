"""Optional JSON Schema shape tests; no model, network, or runtime calls."""
from __future__ import annotations
import copy
import json
from pathlib import Path
import unittest

try:
    from jsonschema import Draft202012Validator
except ImportError as exc:
    raise SystemExit('Optional tests require jsonschema. Install tests/requirements.txt in a test environment.') from exc

ROOT = Path(__file__).resolve().parents[1]
def load(path: str):
    return json.loads((ROOT / path).read_text(encoding='utf-8'))

class ContractTests(unittest.TestCase):
    def setUp(self):
        self.task = load('examples/task.brief.json')
        self.review = load('examples/review.blocked.json')
        self.tv = Draft202012Validator(load('contracts/task.schema.json'))
        self.rv = Draft202012Validator(load('contracts/review.schema.json'))

    def ready_task(self):
        task = copy.deepcopy(self.task)
        task.update(status='PR_READY', scope_snapshot='test-fixture:scope', approval_source='test-fixture:authorization',
                    base_sha='a'*40, head_sha='b'*40, run_id='test-fixture:run',
                    check_evidence=['test-fixture:check'], review_evidence=['test-fixture:review'])
        return task

    def pass_report(self):
        review = copy.deepcopy(self.review)
        review.update(verdict='PASS', base_sha='a'*40, head_sha='b'*40,
                      reviewer_session_ref='test-fixture:reviewer', required_check_status='PASS',
                      check_evidence=['test-fixture:check'], blocked_reason=None,
                      acceptance_results=[{'id':'AC-1','result':'PASS','evidence_refs':['test-fixture:ac']}])
        return review

    def test_schema_definitions_are_valid(self):
        Draft202012Validator.check_schema(self.tv.schema)
        Draft202012Validator.check_schema(self.rv.schema)

    def test_unapproved_brief_and_blocked_report_are_valid(self):
        self.tv.validate(self.task)
        self.rv.validate(self.review)

    def test_synthetic_ready_and_pass_shapes_are_valid_not_trusted(self):
        self.tv.validate(self.ready_task())
        self.rv.validate(self.pass_report())

    def test_ready_requires_review_reference(self):
        task=self.ready_task(); task['review_evidence']=[]
        self.assertFalse(self.tv.is_valid(task))

    def test_active_task_requires_authorization_reference(self):
        task=self.ready_task(); task['approval_source']=None
        self.assertFalse(self.tv.is_valid(task))

    def test_repair_counter_stops_at_two(self):
        task=self.ready_task(); task['fix_cycles_used']=3
        self.assertFalse(self.tv.is_valid(task))

    def test_blocked_task_requires_resume_information(self):
        task=copy.deepcopy(self.task); task['status']='BLOCKED'
        self.assertFalse(self.tv.is_valid(task))
        task.update(resume_from='BRIEF', blocker={'reason':'test','owner':'test','resume_condition':'test'})
        self.tv.validate(task)

    def test_pass_rejects_unknown_required_check(self):
        review=self.pass_report(); review['required_check_status']='UNKNOWN'
        self.assertFalse(self.rv.is_valid(review))

    def test_pass_requires_current_snapshot_reference(self):
        review=self.pass_report(); review['head_sha']=None
        self.assertFalse(self.rv.is_valid(review))

    def test_pass_rejects_unknown_acceptance_criterion(self):
        review=self.pass_report(); review['acceptance_results'][0]['result']='UNKNOWN'
        self.assertFalse(self.rv.is_valid(review))

    def test_changes_required_requires_finding(self):
        review=self.pass_report(); review['verdict']='CHANGES_REQUIRED'
        self.assertFalse(self.rv.is_valid(review))

    def test_blocked_report_requires_reason(self):
        review=copy.deepcopy(self.review); review['blocked_reason']=None
        self.assertFalse(self.rv.is_valid(review))

if __name__ == '__main__':
    unittest.main(verbosity=2)
